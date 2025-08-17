import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixAllIssues() {
    console.log('🔧 Fixing all Cloverleaf issues...\n');
    
    try {
        // 1. Get the correct home IDs for the addresses that exist
        const homeMap = {
            '42927 Cloverleaf Ct': '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // Use the first one
            '42931 Cloverleaf Ct': 'ea62cdc5-d680-4fde-88b7-a8825316fc0a',
            '42942 Cloverleaf Ct': 'f71db520-a55b-487f-95da-c8c8db31e00a'
        };
        
        // 2. Delete duplicate 42927 home
        console.log('1. 🗑️ Deleting duplicate 42927 Cloverleaf Ct...');
        try {
            await client.models.Home.delete({ id: 'cd8c33e8-5d6e-4c9f-9e16-9fd2a312ca4a' });
            console.log('   ✅ Deleted duplicate home');
        } catch (error) {
            console.log('   ⚠️ Could not delete duplicate:', error.message);
        }
        
        // 3. Create 42919 Cloverleaf Ct if it doesn't exist
        console.log('\n2. 🏠 Creating 42919 Cloverleaf Ct...');
        const home42919Query = await client.models.Home.list({
            filter: { street: { eq: '42919 Cloverleaf Ct' } }
        });
        
        let home42919Id;
        if (home42919Query.data?.length === 0) {
            const newHome = await client.models.Home.create({
                street: '42919 Cloverleaf Ct',
                city: 'Broadlands',
                state: 'VA',
                postalCode: '20148',
                absenteeOwner: false,
                lat: 39.0064,
                lng: -77.5165
            });
            home42919Id = newHome.data.id;
            console.log(`   ✅ Created 42919 Cloverleaf Ct (ID: ${home42919Id})`);
        } else {
            home42919Id = home42919Query.data[0].id;
            console.log(`   ✅ 42919 Cloverleaf Ct already exists (ID: ${home42919Id})`);
        }
        homeMap['42919 Cloverleaf Ct'] = home42919Id;
        
        // 4. Create residents for each home
        console.log('\n3. 👥 Creating residents...');
        
        const residentsToCreate = [
            // 42927 Cloverleaf Ct - Simpsons
            { homeId: homeMap['42927 Cloverleaf Ct'], firstName: 'Michael', lastName: 'Simpson', role: 'PRIMARY_OWNER' },
            { homeId: homeMap['42927 Cloverleaf Ct'], firstName: 'Oya', lastName: 'Simpson', role: 'SECONDARY_OWNER' },
            
            // 42931 Cloverleaf Ct - Williams
            { homeId: homeMap['42931 Cloverleaf Ct'], firstName: 'Luther', lastName: 'Williams', role: 'PRIMARY_OWNER' },
            { homeId: homeMap['42931 Cloverleaf Ct'], firstName: 'Rebecca', lastName: 'Williams', role: 'SECONDARY_OWNER' },
            
            // Add some test residents for 42919 and 42942
            { homeId: homeMap['42919 Cloverleaf Ct'], firstName: 'John', lastName: 'Doe', role: 'PRIMARY_OWNER' },
            { homeId: homeMap['42919 Cloverleaf Ct'], firstName: 'Jane', lastName: 'Doe', role: 'SECONDARY_OWNER' },
            { homeId: homeMap['42942 Cloverleaf Ct'], firstName: 'Bob', lastName: 'Smith', role: 'PRIMARY_OWNER' },
            { homeId: homeMap['42942 Cloverleaf Ct'], firstName: 'Alice', lastName: 'Smith', role: 'SECONDARY_OWNER' }
        ];
        
        for (const resident of residentsToCreate) {
            // Check if resident already exists
            const existingResident = await client.models.Person.list({
                filter: {
                    homeId: { eq: resident.homeId },
                    firstName: { eq: resident.firstName },
                    lastName: { eq: resident.lastName }
                }
            });
            
            if (existingResident.data?.length === 0) {
                try {
                    await client.models.Person.create({
                        ...resident,
                        hasSigned: false
                    });
                    console.log(`   ✅ Created ${resident.firstName} ${resident.lastName} at ${Object.keys(homeMap).find(k => homeMap[k] === resident.homeId)}`);
                } catch (error) {
                    console.log(`   ❌ Failed to create ${resident.firstName} ${resident.lastName}:`, error.message);
                }
            } else {
                console.log(`   ⚠️ ${resident.firstName} ${resident.lastName} already exists`);
            }
        }
        
        // 5. Fix assignments - ensure all 4 target homes have assignments
        console.log('\n4. 📋 Fixing assignments...');
        
        // Use the first volunteer (there are duplicates)
        const volunteers = await client.models.Volunteer.list();
        const volunteer = volunteers.data?.[0];
        
        if (volunteer) {
            for (const [address, homeId] of Object.entries(homeMap)) {
                // Check if assignment exists
                const existingAssignment = await client.models.Assignment.list({
                    filter: {
                        homeId: { eq: homeId },
                        volunteerId: { eq: volunteer.id }
                    }
                });
                
                if (existingAssignment.data?.length === 0) {
                    try {
                        await client.models.Assignment.create({
                            homeId: homeId,
                            volunteerId: volunteer.id,
                            status: 'NOT_STARTED',
                            assignedAt: new Date().toISOString()
                        });
                        console.log(`   ✅ Created assignment for ${address}`);
                    } catch (error) {
                        console.log(`   ❌ Failed to create assignment for ${address}:`, error.message);
                    }
                } else {
                    console.log(`   ⚠️ Assignment already exists for ${address}`);
                }
            }
        }
        
        // 6. Final verification
        console.log('\n5. ✅ VERIFICATION:');
        console.log('═══════════════════════════════════════════════════\n');
        
        for (const [address, homeId] of Object.entries(homeMap)) {
            const residents = await client.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            
            console.log(`${address}:`);
            console.log(`  Residents: ${residents.data?.length}`);
            residents.data?.forEach(r => {
                console.log(`    - ${r.firstName} ${r.lastName} (${r.role})`);
            });
        }
        
        console.log('\n🎉 All issues should now be fixed!');
        console.log('The canvassing page should show:');
        console.log('  - 4 assigned homes with markers');
        console.log('  - Correct residents when clicking markers');
        console.log('  - Michael & Oya Simpson at 42927');
        console.log('  - Luther & Rebecca Williams at 42931');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

fixAllIssues();