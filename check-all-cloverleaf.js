import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkAllCloverleaf() {
    console.log('🔍 Checking ALL Cloverleaf homes and residents...\n');
    
    try {
        // Get all Cloverleaf homes
        const cloverleafHomes = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } },
            limit: 1000
        });
        
        console.log(`Found ${cloverleafHomes.data?.length || 0} Cloverleaf homes:\n`);
        
        // Get all people
        const allPeople = await client.models.Person.list({ limit: 10000 });
        const cloverleafHomeIds = cloverleafHomes.data.map(h => h.id);
        
        for (const home of cloverleafHomes.data) {
            console.log(`🏠 ${home.street}`);
            console.log(`   ID: ${home.id}`);
            console.log(`   City: ${home.city}, ${home.state}`);
            console.log(`   Coordinates: ${home.lat}, ${home.lng}`);
            
            // Get residents for this home
            const residents = allPeople.data.filter(person => person.homeId === home.id);
            
            console.log(`   Residents: ${residents.length}`);
            if (residents.length > 0) {
                residents.forEach(resident => {
                    console.log(`     - ${resident.firstName} ${resident.lastName} (${resident.role})`);
                });
            } else {
                console.log(`     - No residents`);
            }
            console.log('');
        }
        
        // Summary
        console.log('📋 SUMMARY:');
        cloverleafHomes.data.forEach(home => {
            const residents = allPeople.data.filter(person => person.homeId === home.id);
            console.log(`• ${home.street}: ${residents.length} residents`);
        });
        
        // Check if any assignments exist for these homes
        console.log('\n📋 Checking assignments for Cloverleaf homes...');
        const assignments = await client.models.Assignment.list();
        const cloverleafAssignments = assignments.data.filter(a => 
            cloverleafHomeIds.includes(a.homeId)
        );
        
        console.log(`Found ${cloverleafAssignments.length} assignments for Cloverleaf homes:`);
        cloverleafAssignments.forEach(assignment => {
            const home = cloverleafHomes.data.find(h => h.id === assignment.homeId);
            console.log(`  - ${home?.street || assignment.homeId} (Status: ${assignment.status})`);
        });
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkAllCloverleaf();