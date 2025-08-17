import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkResidentFiltering() {
    console.log('🔍 CHECKING RESIDENT FILTERING FOR HOMES WITH 0 RESIDENTS\n');
    
    try {
        const problemHomeIds = [
            'f8844237-ab44-4c35-a68a-f80d7ea107c4', // 42919 
            '55d9b2b3-a92b-40c3-bd86-c08e0ae42070', // 42919
            '4a314731-5709-45c4-8f04-96e9f8d81426', // 42919
            '0d112ee2-7913-46ff-8b22-ec655a7ffb20'  // 42942
        ];
        
        for (const homeId of problemHomeIds) {
            const home = await client.models.Home.get({ id: homeId });
            console.log(`🏠 ${home.data.street} (ID: ${homeId})`);
            
            const residents = await client.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            
            console.log(`   Raw residents: ${residents.data.length}`);
            
            if (residents.data.length > 0) {
                residents.data.forEach(r => {
                    const fullName = `${r.firstName || ''} ${r.lastName || ''}`;
                    console.log(`     - ${fullName} (${r.role})`);
                });
                
                // Apply the same filtering as canvassing map
                const realResidents = residents.data.filter(person => {
                    const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
                    const testPatterns = ['test', 'manual', 'debug', 'sample', 'fake', 'demo', 'resident'];
                    const specificFakes = ['test resident', 'manual resident', 'manual test', 'joe smith (test)', 'jane doe', 'john doe', 'bob smith'];
                    
                    const hasTestPattern = testPatterns.some(pattern => fullName.includes(pattern));
                    const isSpecificFake = specificFakes.some(fake => fullName.includes(fake));
                    
                    return !hasTestPattern && !isSpecificFake;
                });
                
                console.log(`   After filtering: ${realResidents.length}`);
                
                if (realResidents.length !== residents.data.length) {
                    console.log('   🧹 FILTERED OUT:');
                    residents.data.forEach(r => {
                        const fullName = `${r.firstName || ''} ${r.lastName || ''}`;
                        const fullNameLower = fullName.toLowerCase();
                        const testPatterns = ['test', 'manual', 'debug', 'sample', 'fake', 'demo', 'resident'];
                        const specificFakes = ['test resident', 'manual resident', 'manual test', 'joe smith (test)', 'jane doe', 'john doe', 'bob smith'];
                        
                        const hasTestPattern = testPatterns.some(pattern => fullNameLower.includes(pattern));
                        const isSpecificFake = specificFakes.some(fake => fullNameLower.includes(fake));
                        
                        if (hasTestPattern || isSpecificFake) {
                            console.log(`     ❌ ${fullName} (matched: ${hasTestPattern ? 'test pattern' : 'specific fake'})`);
                        }
                    });
                }
                
                if (realResidents.length > 0) {
                    console.log('   ✅ REMAINING RESIDENTS:');
                    realResidents.forEach(r => {
                        console.log(`     ✓ ${r.firstName} ${r.lastName} (${r.role})`);
                    });
                }
            } else {
                console.log('   ⚠️ No residents found in database for this home');
            }
            
            console.log('');
        }
        
        console.log('🎯 CONCLUSION:');
        console.log('If homes show 0 residents after filtering, they should still appear on the map');
        console.log('The issue might be that the map UI hides markers with no residents');
        console.log('Or there could be duplicate coordinates causing markers to overlap');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkResidentFiltering();