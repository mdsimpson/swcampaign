import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkDatabaseState() {
    console.log('🔍 Checking database state...');
    
    try {
        // Check homes
        const homesResult = await client.models.Home.list({ limit: 10 });
        console.log(`🏠 Total homes (sample): ${homesResult.data?.length || 0}`);
        if (homesResult.data?.length > 0) {
            console.log('Sample homes:');
            homesResult.data.slice(0, 3).forEach(home => {
                console.log(`  ${home.street}, ${home.city} (ID: ${home.id})`);
            });
        }
        
        // Check residents
        const peopleResult = await client.models.Person.list({ limit: 10 });
        console.log(`\n👥 Total residents (sample): ${peopleResult.data?.length || 0}`);
        if (peopleResult.data?.length > 0) {
            console.log('Sample residents:');
            peopleResult.data.slice(0, 3).forEach(person => {
                console.log(`  ${person.firstName} ${person.lastName} - homeId: ${person.homeId}`);
            });
        }
        
        // Check volunteers
        const volunteersResult = await client.models.Volunteer.list();
        console.log(`\n👤 Total volunteers: ${volunteersResult.data?.length || 0}`);
        if (volunteersResult.data?.length > 0) {
            console.log('All volunteers:');
            volunteersResult.data.forEach(volunteer => {
                console.log(`  ${volunteer.displayName} - ${volunteer.email}`);
            });
        }
        
        // Check assignments
        const assignmentsResult = await client.models.Assignment.list();
        console.log(`\n📋 Total assignments: ${assignmentsResult.data?.length || 0}`);
        if (assignmentsResult.data?.length > 0) {
            console.log('Sample assignments:');
            assignmentsResult.data.slice(0, 3).forEach(assignment => {
                console.log(`  Home ${assignment.homeId} -> Volunteer ${assignment.volunteerId} (${assignment.status})`);
            });
        }
        
        // Specifically search for Cloverleaf homes
        console.log('\n🔍 Searching for Cloverleaf homes...');
        const cloverleafHomes = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } }
        });
        console.log(`Found ${cloverleafHomes.data?.length || 0} Cloverleaf homes:`);
        if (cloverleafHomes.data?.length > 0) {
            cloverleafHomes.data.forEach(home => {
                console.log(`  ${home.street} (ID: ${home.id}, coords: ${home.lat}, ${home.lng})`);
            });
        }
        
        // Search for Simpson and Williams residents
        console.log('\n🔍 Searching for Simpson and Williams residents...');
        const simpsons = await client.models.Person.list({
            filter: { lastName: { eq: 'Simpson' } }
        });
        console.log(`Found ${simpsons.data?.length || 0} Simpson residents:`);
        simpsons.data?.forEach(person => {
            console.log(`  ${person.firstName} ${person.lastName} - homeId: ${person.homeId} (${person.role})`);
        });
        
        const williams = await client.models.Person.list({
            filter: { lastName: { eq: 'Williams' } }
        });
        console.log(`Found ${williams.data?.length || 0} Williams residents:`);
        williams.data?.forEach(person => {
            console.log(`  ${person.firstName} ${person.lastName} - homeId: ${person.homeId} (${person.role})`);
        });
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

checkDatabaseState();