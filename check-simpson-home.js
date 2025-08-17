import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkSimpsonHome() {
    console.log('🔍 Checking Michael Simpson home...');
    
    try {
        // Check Michael Simpson's home
        const michaelHomeResult = await client.models.Home.get({ 
            id: '362d06fc-7b70-434b-81a7-fb3bde43dd7f' 
        });
        
        if (michaelHomeResult.data) {
            console.log(`✅ Michael Simpson's home: ${michaelHomeResult.data.street}`);
            console.log(`   City: ${michaelHomeResult.data.city}`);
            console.log(`   Coordinates: ${michaelHomeResult.data.lat}, ${michaelHomeResult.data.lng}`);
        } else {
            console.log('❌ Michael Simpson\'s home not found!');
        }
        
        // Get all residents for this home
        const residentsResult = await client.models.Person.list({
            filter: { homeId: { eq: '362d06fc-7b70-434b-81a7-fb3bde43dd7f' } }
        });
        
        console.log(`\n👥 Residents for Michael Simpson's home: ${residentsResult.data?.length || 0}`);
        if (residentsResult.data?.length > 0) {
            residentsResult.data.forEach(resident => {
                console.log(`   ${resident.firstName} ${resident.lastName} (${resident.role})`);
            });
        }
        
        // Now check Luther Williams home again to get all residents
        console.log('\n🔍 Checking Luther Williams home residents...');
        const lutherResidentsResult = await client.models.Person.list({
            filter: { homeId: { eq: 'b54f3380-85c8-42b2-84fc-01d155d1ac52' } }
        });
        
        console.log(`👥 Residents for Luther Williams's home: ${lutherResidentsResult.data?.length || 0}`);
        if (lutherResidentsResult.data?.length > 0) {
            lutherResidentsResult.data.forEach(resident => {
                console.log(`   ${resident.firstName} ${resident.lastName} (${resident.role})`);
            });
        }
        
        // Search for Rebecca Williams by exact name match
        console.log('\n🔍 Searching for Rebecca Williams...');
        const rebeccaQuery = await client.models.Person.list({
            filter: { 
                firstName: { eq: 'Rebecca' },
                lastName: { eq: 'Williams' }
            }
        });
        
        console.log(`Found ${rebeccaQuery.data?.length || 0} Rebecca Williams records:`);
        if (rebeccaQuery.data?.length > 0) {
            for (const rebecca of rebeccaQuery.data) {
                console.log(`   Rebecca Williams - homeId: ${rebecca.homeId} (${rebecca.role})`);
                
                // Get home address for this Rebecca
                const rebeccaHomeResult = await client.models.Home.get({ id: rebecca.homeId });
                if (rebeccaHomeResult.data) {
                    console.log(`     Lives at: ${rebeccaHomeResult.data.street}`);
                }
            }
        }
        
        // Search for Oya Simpson by exact name match
        console.log('\n🔍 Searching for Oya Simpson...');
        const oyaQuery = await client.models.Person.list({
            filter: { 
                firstName: { eq: 'Oya' },
                lastName: { eq: 'Simpson' }
            }
        });
        
        console.log(`Found ${oyaQuery.data?.length || 0} Oya Simpson records:`);
        if (oyaQuery.data?.length > 0) {
            for (const oya of oyaQuery.data) {
                console.log(`   Oya Simpson - homeId: ${oya.homeId} (${oya.role})`);
                
                // Get home address for this Oya
                const oyaHomeResult = await client.models.Home.get({ id: oya.homeId });
                if (oyaHomeResult.data) {
                    console.log(`     Lives at: ${oyaHomeResult.data.street}`);
                }
            }
        }
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

checkSimpsonHome();