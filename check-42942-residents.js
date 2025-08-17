import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function check42942Residents() {
    console.log('🔍 Checking residents of 42942 Cloverleaf Ct...\n');
    
    try {
        // Find the home record for 42942 Cloverleaf Ct
        const homeQuery = await client.models.Home.list({
            filter: { street: { contains: '42942 Cloverleaf' } }
        });
        
        console.log(`Found ${homeQuery.data?.length || 0} home records matching "42942 Cloverleaf":`);
        
        if (homeQuery.data?.length === 0) {
            console.log('❌ No home found for 42942 Cloverleaf Ct');
            return;
        }
        
        // Show all matching homes
        for (const home of homeQuery.data) {
            console.log(`\n🏠 Home: ${home.street}`);
            console.log(`   ID: ${home.id}`);
            console.log(`   City: ${home.city}, ${home.state}`);
            console.log(`   Coordinates: ${home.lat}, ${home.lng}`);
            
            // Get residents for this specific home
            const residentsQuery = await client.models.Person.list({
                filter: { homeId: { eq: home.id } }
            });
            
            console.log(`\n👥 Residents for this home: ${residentsQuery.data?.length || 0}`);
            
            if (residentsQuery.data?.length > 0) {
                residentsQuery.data.forEach((resident, index) => {
                    console.log(`   ${index + 1}. ${resident.firstName} ${resident.lastName}`);
                    console.log(`      Role: ${resident.role}`);
                    console.log(`      Signed: ${resident.hasSigned ? '✓' : '✗'}`);
                    console.log(`      ID: ${resident.id}`);
                });
            } else {
                console.log('   No residents found');
            }
        }
        
        // Also check all people to see if anyone has a homeId that might match
        console.log('\n🔍 Checking all residents for any with homeIds matching these homes...');
        
        const allPeople = await client.models.Person.list({ limit: 10000 });
        const homeIds = homeQuery.data.map(h => h.id);
        
        const allResidentsForTheseHomes = allPeople.data.filter(person => 
            homeIds.includes(person.homeId)
        );
        
        console.log(`\n📊 Total residents across all 42942 Cloverleaf home records: ${allResidentsForTheseHomes.length}`);
        
        if (allResidentsForTheseHomes.length > 0) {
            console.log('\nAll residents found:');
            allResidentsForTheseHomes.forEach((resident, index) => {
                console.log(`   ${index + 1}. ${resident.firstName} ${resident.lastName} (${resident.role})`);
                console.log(`      Home ID: ${resident.homeId}`);
            });
        }
        
        // Summary
        console.log('\n📋 SUMMARY:');
        console.log(`• Home records for "42942 Cloverleaf": ${homeQuery.data.length}`);
        console.log(`• Total residents: ${allResidentsForTheseHomes.length}`);
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

check42942Residents();