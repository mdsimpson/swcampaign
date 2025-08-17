import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function addMissingOwners() {
    console.log('🏠 ADDING MISSING PROPERTY OWNERS AS NON-RESIDENT OWNERS\n');
    
    try {
        // Step 1: Load homeowner data
        console.log('1. Reading Homeowner2.csv...');
        const homeownerCsv = readFileSync('./.data/Homeowner2.csv', 'utf8');
        const homeownerLines = homeownerCsv.split('\n').filter(line => line.trim());
        
        const homeowners = [];
        for (let i = 0; i < homeownerLines.length; i++) {
            const parts = homeownerLines[i].split('|');
            if (parts.length >= 3) {
                const [propertyAddress, ownerKey, ...details] = parts;
                const detailsParts = details[0].split(',');
                
                if (detailsParts.length >= 8) {
                    homeowners.push({
                        propertyAddress: propertyAddress.trim(),
                        firstName: detailsParts[0],
                        lastName: detailsParts[1],
                        role: detailsParts[2],
                        street: detailsParts[3],
                        city: detailsParts[4],
                        state: detailsParts[5],
                        zip: detailsParts[6],
                        email: detailsParts[9] || '',
                        phone: detailsParts[11] || '',
                        residencyStatus: detailsParts[13] || 'Out'
                    });
                }
            }
        }
        
        console.log(`   ✅ Parsed ${homeowners.length} homeowner records`);
        
        // Step 2: Load existing addresses and residents
        console.log('\n2. Loading existing addresses and residents...');
        
        const [addressesResult, residentsResult] = await Promise.all([
            client.models.Address.list({ limit: 5000 }),
            client.models.Resident.list({ limit: 5000 })
        ]);
        
        const addresses = addressesResult.data;
        const residents = residentsResult.data;
        
        console.log(`   📍 Found ${addresses.length} addresses`);
        console.log(`   👥 Found ${residents.length} residents`);
        
        // Step 3: Create address lookup
        const addressLookup = new Map();
        addresses.forEach(addr => {
            const key = `${addr.street?.toLowerCase().trim()}, ${addr.city?.toLowerCase().trim()}`;
            if (!addressLookup.has(key)) {
                addressLookup.set(key, []);
            }
            addressLookup.get(key).push(addr.id);
        });
        
        // Step 4: Create resident lookup
        const residentLookup = new Map();
        residents.forEach(resident => {
            const key = `${resident.firstName?.toLowerCase().trim()} ${resident.lastName?.toLowerCase().trim()}`;
            if (!residentLookup.has(key)) {
                residentLookup.set(key, []);
            }
            residentLookup.get(key).push(resident);
        });
        
        // Step 5: Find missing owners
        console.log('\n3. Finding missing property owners...');
        
        const missingOwners = [];
        
        for (const homeowner of homeowners) {
            const propertyKey = `${homeowner.propertyAddress.toLowerCase().trim()}, ${homeowner.city.toLowerCase().trim()}`;
            const ownerKey = `${homeowner.firstName.toLowerCase().trim()} ${homeowner.lastName.toLowerCase().trim()}`;
            
            // Get address IDs for this property
            const addressIds = addressLookup.get(propertyKey) || [];
            
            if (addressIds.length === 0) {
                console.log(`   ⚠️ No address found for property: ${homeowner.propertyAddress}`);
                continue;
            }
            
            // Check if this owner is already listed as a resident at this property
            const existingResidents = residentLookup.get(ownerKey) || [];
            const isAlreadyResident = existingResidents.some(resident => 
                addressIds.includes(resident.addressId)
            );
            
            if (!isAlreadyResident) {
                // This owner is missing from the property - add them as non-resident owner
                missingOwners.push({
                    firstName: homeowner.firstName,
                    lastName: homeowner.lastName,
                    occupantType: homeowner.role,
                    role: homeowner.role, // For compatibility
                    street: homeowner.propertyAddress,
                    city: homeowner.city,
                    state: homeowner.state,
                    zip: homeowner.zip,
                    addressIds: addressIds, // All duplicate address IDs for this property
                    contactEmail: homeowner.email || undefined,
                    cellPhone: homeowner.phone || undefined,
                    isAbsentee: homeowner.residencyStatus === 'Out', // They don't live at this property
                    isNonResidentOwner: true // Flag to indicate this is a property owner who lives elsewhere
                });
            }
        }
        
        console.log(`   ✅ Found ${missingOwners.length} missing property owners`);
        
        // Step 6: Add missing owners to database
        console.log('\n4. Adding missing owners to database...');
        
        let addedCount = 0;
        
        for (const owner of missingOwners) {
            // Add this owner to each address ID for this property
            for (const addressId of owner.addressIds) {
                try {
                    console.log(`   Adding ${owner.firstName} ${owner.lastName} to ${owner.street} (${addressId})`);
                    
                    await client.models.Resident.create({
                        addressId: addressId,
                        firstName: owner.firstName,
                        lastName: owner.lastName,
                        occupantType: owner.occupantType,
                        contactEmail: owner.contactEmail,
                        cellPhone: owner.cellPhone,
                        isAbsentee: owner.isAbsentee
                    });
                    
                    addedCount++;
                } catch (error) {
                    console.log(`   ❌ Failed to add ${owner.firstName} ${owner.lastName}: ${error.message}`);
                }
            }
        }
        
        console.log(`\n✅ Successfully added ${addedCount} missing property owners`);
        console.log('\n🎉 PROCESS COMPLETE!');
        console.log('All property owners should now appear in the canvassing map popups.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

addMissingOwners();