import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function clearAllDataAndImportNew() {
    console.log('🗑️ CLEARING ALL EXISTING DATA AND IMPORTING NEW STRUCTURE\n');
    
    try {
        // Step 1: Clear all existing data
        console.log('1. Clearing all existing data...');
        
        // Clear in dependency order
        const entityTypes = [
            'Consent',
            'InteractionRecord', 
            'Assignment',
            'Person', // Old model
            'Home',   // Old model
            'Registration'
        ];
        
        for (const entityType of entityTypes) {
            try {
                console.log(`   Clearing ${entityType}...`);
                const items = await client.models[entityType].list({ limit: 1000 });
                console.log(`   Found ${items.data.length} ${entityType} records`);
                
                for (const item of items.data) {
                    try {
                        await client.models[entityType].delete({ id: item.id });
                    } catch (error) {
                        console.log(`   Warning: Could not delete ${entityType} ${item.id}: ${error.message}`);
                    }
                }
                console.log(`   ✅ Cleared ${entityType}`);
            } catch (error) {
                console.log(`   ⚠️ Warning: Could not clear ${entityType}: ${error.message}`);
            }
        }
        
        console.log('\n   ⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 2: Read and parse CSV files
        console.log('\n2. Reading CSV files...');
        
        const addressCsv = readFileSync('./.data/address.csv', 'utf8');
        const residentsCsv = readFileSync('./.data/residents.csv', 'utf8');
        
        // Parse address.csv
        const addressLines = addressCsv.split('\n').filter(line => line.trim());
        const addressHeaders = addressLines[0].split(',').map(h => h.replace(/"/g, '').trim());
        console.log('   Address headers:', addressHeaders);
        
        const addresses = [];
        for (let i = 1; i < addressLines.length; i++) {
            const values = parseCSVLine(addressLines[i]);
            if (values.length >= 7) {
                addresses.push({
                    externalId: values[0],
                    street: values[1],
                    city: values[2], 
                    state: values[3],
                    zip: values[4],
                    lat: parseFloat(values[5]) || undefined,
                    lng: parseFloat(values[6]) || undefined
                });
            }
        }
        
        console.log(`   ✅ Parsed ${addresses.length} addresses`);
        
        // Parse residents.csv
        const residentLines = residentsCsv.split('\n').filter(line => line.trim());
        const residentHeaders = residentLines[0].split(',').map(h => h.replace(/"/g, '').trim());
        console.log('   Resident headers:', residentHeaders);
        
        const residents = [];
        for (let i = 1; i < residentLines.length; i++) {
            const values = parseCSVLine(residentLines[i]);
            if (values.length >= 16) {
                residents.push({
                    externalId: values[0],
                    firstName: values[1],
                    lastName: values[2],
                    occupantType: values[3],
                    street: values[4],
                    city: values[5],
                    state: values[6],
                    zip: values[7],
                    addressId: values[8], // Foreign key to address
                    contactEmail: values[9],
                    additionalEmail: values[10],
                    cellPhone: values[11],
                    cellPhoneAlert: values[12],
                    unitPhone: values[13],
                    workPhone: values[14],
                    isAbsentee: values[15] === 'true'
                });
            }
        }
        
        console.log(`   ✅ Parsed ${residents.length} residents`);
        
        // Step 3: Import addresses
        console.log('\n3. Importing addresses...');
        
        const addressMap = new Map(); // externalId -> amplify ID
        
        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            
            try {
                console.log(`   Importing ${i + 1}/${addresses.length}: ${address.street}`);
                
                const result = await client.models.Address.create({
                    externalId: address.externalId,
                    street: address.street,
                    city: address.city,
                    state: address.state,
                    zip: address.zip,
                    lat: address.lat,
                    lng: address.lng
                });
                
                addressMap.set(address.externalId, result.data.id);
                
                if (i % 50 === 0) {
                    console.log(`   Progress: ${i + 1}/${addresses.length} addresses imported`);
                }
                
            } catch (error) {
                console.log(`   ❌ Failed to import address ${address.street}: ${error.message}`);
            }
        }
        
        console.log(`   ✅ Imported ${addressMap.size} addresses`);
        
        // Step 4: Import residents
        console.log('\n4. Importing residents...');
        
        let importedResidents = 0;
        
        for (let i = 0; i < residents.length; i++) {
            const resident = residents[i];
            
            try {
                // Get the Amplify address ID
                const amplifyAddressId = addressMap.get(resident.addressId);
                
                if (!amplifyAddressId) {
                    console.log(`   ⚠️ Skipping resident ${resident.firstName} ${resident.lastName}: address ${resident.addressId} not found`);
                    continue;
                }
                
                console.log(`   Importing ${i + 1}/${residents.length}: ${resident.firstName} ${resident.lastName}`);
                
                await client.models.Resident.create({
                    externalId: resident.externalId,
                    addressId: amplifyAddressId,
                    firstName: resident.firstName,
                    lastName: resident.lastName,
                    occupantType: resident.occupantType,
                    contactEmail: resident.contactEmail || undefined,
                    additionalEmail: resident.additionalEmail || undefined,
                    cellPhone: resident.cellPhone || undefined,
                    cellPhoneAlert: resident.cellPhoneAlert || undefined,
                    unitPhone: resident.unitPhone || undefined,
                    workPhone: resident.workPhone || undefined,
                    isAbsentee: resident.isAbsentee
                });
                
                importedResidents++;
                
                if (i % 50 === 0) {
                    console.log(`   Progress: ${i + 1}/${residents.length} residents processed, ${importedResidents} imported`);
                }
                
            } catch (error) {
                console.log(`   ❌ Failed to import resident ${resident.firstName} ${resident.lastName}: ${error.message}`);
            }
        }
        
        console.log(`   ✅ Imported ${importedResidents} residents`);
        
        // Step 5: Verification
        console.log('\n5. Verification...');
        
        const finalAddresses = await client.models.Address.list({ limit: 1000 });
        const finalResidents = await client.models.Resident.list({ limit: 1000 });
        
        console.log(`\n📊 IMPORT SUMMARY:`);
        console.log(`• Addresses imported: ${finalAddresses.data.length}`);
        console.log(`• Residents imported: ${finalResidents.data.length}`);
        console.log(`• Address mapping: ${addressMap.size} external IDs mapped`);
        
        console.log('\n🎉 DATA IMPORT COMPLETE!');
        console.log('Next steps:');
        console.log('1. Deploy the schema changes');
        console.log('2. Update all pages to use Address/Resident models');
        console.log('3. Test the canvassing functionality');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

clearAllDataAndImportNew();