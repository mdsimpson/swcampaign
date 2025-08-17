import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });

// Try both API modes
const apiKeyClient = generateClient({ authMode: 'apiKey' });
const userPoolClient = generateClient({ authMode: 'userPool' });

async function checkWithBothModes() {
    console.log('🔍 Checking data with both API modes...\n');
    
    try {
        // Test with API Key
        console.log('1. 📊 Using API Key access:');
        
        const apiKeyHomes = await apiKeyClient.models.Home.list({
            filter: { street: { contains: '42927' } }
        });
        console.log(`   Homes found: ${apiKeyHomes.data?.length}`);
        
        if (apiKeyHomes.data?.length > 0) {
            const homeId = apiKeyHomes.data[0].id;
            console.log(`   Checking residents for home ID: ${homeId}`);
            
            const apiKeyResidents = await apiKeyClient.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            console.log(`   Residents found: ${apiKeyResidents.data?.length}`);
            
            if (apiKeyResidents.data?.length > 0) {
                apiKeyResidents.data.forEach(r => {
                    console.log(`     - ${r.firstName} ${r.lastName} (${r.role})`);
                });
            }
        }
        
        // Test with User Pool (might fail if no user is authenticated)
        console.log('\n2. 📊 Using User Pool access:');
        try {
            const userPoolHomes = await userPoolClient.models.Home.list({
                filter: { street: { contains: '42927' } }
            });
            console.log(`   Homes found: ${userPoolHomes.data?.length}`);
            
            if (userPoolHomes.data?.length > 0) {
                const homeId = userPoolHomes.data[0].id;
                const userPoolResidents = await userPoolClient.models.Person.list({
                    filter: { homeId: { eq: homeId } }
                });
                console.log(`   Residents found: ${userPoolResidents.data?.length}`);
                
                if (userPoolResidents.data?.length > 0) {
                    userPoolResidents.data.forEach(r => {
                        console.log(`     - ${r.firstName} ${r.lastName} (${r.role})`);
                    });
                }
            }
        } catch (userPoolError) {
            console.log(`   ❌ User Pool access failed: ${userPoolError.message}`);
        }
        
        // 3. Check all people with pagination
        console.log('\n3. 📊 Checking all people in database:');
        
        const allPeople = await apiKeyClient.models.Person.list({ limit: 1000 });
        console.log(`   Total people: ${allPeople.data?.length}`);
        
        // Filter for Simpsons and Williams
        const simpsons = allPeople.data?.filter(p => p.lastName === 'Simpson') || [];
        const williams = allPeople.data?.filter(p => p.lastName === 'Williams') || [];
        
        console.log(`   Simpsons: ${simpsons.length}`);
        simpsons.forEach(s => {
            console.log(`     - ${s.firstName} ${s.lastName} (homeId: ${s.homeId})`);
        });
        
        console.log(`   Williams: ${williams.length}`);
        williams.forEach(w => {
            console.log(`     - ${w.firstName} ${w.lastName} (homeId: ${w.homeId})`);
        });
        
        // 4. Direct query by specific home IDs
        console.log('\n4. 📊 Direct queries by home ID:');
        
        const homeIds = [
            '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // 42927 original
            'ea62cdc5-d680-4fde-88b7-a8825316fc0a', // 42931
            'f71db520-a55b-487f-95da-c8c8db31e00a', // 42942
            'f8844237-ab44-4c35-a68a-f80d7ea107c4'  // 42919 new
        ];
        
        for (const homeId of homeIds) {
            const residents = await apiKeyClient.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            console.log(`   ${homeId}: ${residents.data?.length} residents`);
            
            if (residents.data?.length > 0) {
                residents.data.forEach(r => {
                    console.log(`     - ${r.firstName} ${r.lastName}`);
                });
            }
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkWithBothModes();