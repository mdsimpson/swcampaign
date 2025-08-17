import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function testWilliamsFix() {
    console.log('🔍 Testing Williams family fix...');
    
    try {
        // Search for Williams residents
        const williamsQuery = await client.models.Person.list({
            filter: { lastName: { eq: 'Williams' } }
        });
        
        console.log(`Found ${williamsQuery.data?.length || 0} Williams residents:`);
        if (williamsQuery.data?.length > 0) {
            for (const person of williamsQuery.data) {
                console.log(`  ${person.firstName} ${person.lastName} - homeId: ${person.homeId}`);
                
                // Get the home for this person
                const homeResult = await client.models.Home.get({ id: person.homeId });
                if (homeResult.data) {
                    console.log(`    Lives at: ${homeResult.data.street}`);
                }
            }
        }
        
        // Search for homes with "42931 Cloverleaf"
        const homeQuery = await client.models.Home.list({
            filter: { street: { contains: '42931 Cloverleaf' } }
        });
        
        console.log(`\nFound ${homeQuery.data?.length || 0} homes matching "42931 Cloverleaf":`);
        if (homeQuery.data?.length > 0) {
            for (const home of homeQuery.data) {
                console.log(`  ${home.street} - ID: ${home.id}`);
                
                // Get residents for this home
                const residentsResult = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                });
                
                console.log(`    Residents: ${residentsResult.data?.length || 0}`);
                if (residentsResult.data?.length > 0) {
                    residentsResult.data.forEach(resident => {
                        console.log(`      ${resident.firstName} ${resident.lastName} (${resident.role})`);
                    });
                }
            }
        }
        
        console.log('\n✅ Test complete!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testWilliamsFix();