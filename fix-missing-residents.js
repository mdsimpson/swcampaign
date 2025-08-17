import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixMissingResidents() {
    console.log('🔧 FIXING MISSING RESIDENTS FOR ASSIGNED HOMES\n');
    
    try {
        const homeResidentData = [
            {
                address: '42919 Cloverleaf Ct',
                residents: [
                    { firstName: 'Tamsen', lastName: 'Ariganello', role: 'PRIMARY_OWNER' },
                    { firstName: 'Joseph', lastName: 'Ariganello', role: 'SECONDARY_OWNER' }
                ]
            },
            {
                address: '42942 Cloverleaf Ct',
                residents: [
                    { firstName: 'David', lastName: 'Divins', role: 'PRIMARY_OWNER' },
                    { firstName: 'Pamela', lastName: 'Divins', role: 'SECONDARY_OWNER' }
                ]
            }
        ];
        
        for (const homeData of homeResidentData) {
            console.log(`🏠 Processing ${homeData.address}...`);
            
            // Find all home records for this address
            const homes = await client.models.Home.list({
                filter: { street: { eq: homeData.address } }
            });
            
            console.log(`   Found ${homes.data.length} home records`);
            
            for (const home of homes.data) {
                console.log(`   📍 Home ID: ${home.id}`);
                
                // Check if this home already has residents
                const existingResidents = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                });
                
                console.log(`      Existing residents: ${existingResidents.data.length}`);
                
                if (existingResidents.data.length === 0) {
                    console.log(`      ✨ Adding residents...`);
                    
                    // Add the residents from CSV data
                    for (const residentData of homeData.residents) {
                        try {
                            await client.models.Person.create({
                                homeId: home.id,
                                firstName: residentData.firstName,
                                lastName: residentData.lastName,
                                role: residentData.role,
                                hasSigned: false,
                                email: undefined,
                                mobilePhone: undefined
                            });
                            
                            console.log(`         ✅ Added ${residentData.firstName} ${residentData.lastName} (${residentData.role})`);
                        } catch (error) {
                            console.log(`         ❌ Failed to add ${residentData.firstName} ${residentData.lastName}: ${error.message}`);
                        }
                    }
                } else {
                    console.log(`      ✅ Already has residents:`);
                    existingResidents.data.forEach(r => {
                        console.log(`         - ${r.firstName} ${r.lastName} (${r.role})`);
                    });
                }
                
                console.log('');
            }
        }
        
        console.log('⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verification
        console.log('✅ VERIFICATION:');
        for (const homeData of homeResidentData) {
            console.log(`\n🏠 ${homeData.address}:`);
            
            const homes = await client.models.Home.list({
                filter: { street: { eq: homeData.address } }
            });
            
            for (const home of homes.data) {
                const residents = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                });
                
                console.log(`   📍 Home ${home.id}: ${residents.data.length} residents`);
                residents.data.forEach(r => {
                    console.log(`      - ${r.firstName} ${r.lastName} (${r.role})`);
                });
            }
        }
        
        console.log('\n🎉 RESIDENTS FIXED!');
        console.log('The canvassing map should now show all assigned homes with proper residents.');
        console.log('Refresh the canvassing page to see the updated markers.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

fixMissingResidents();