import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkSpecificAddress() {
    console.log('🔍 CHECKING 42911 CLOVERLEAF CT COORDINATES\n');
    
    try {
        const homes = await client.models.Home.list({
            filter: { street: { eq: '42911 Cloverleaf Ct' } }
        });
        
        console.log(`Found ${homes.data.length} home records for 42911 Cloverleaf Ct:\n`);
        
        homes.data.forEach((home, index) => {
            console.log(`${index + 1}. Home ID: ${home.id}`);
            console.log(`   Coordinates: ${home.lat}, ${home.lng}`);
            console.log(`   Created: ${home.createdAt}`);
            console.log(`   Updated: ${home.updatedAt}`);
            console.log('');
        });
        
        // Check if this address has assignments
        const volunteers = await client.models.Volunteer.list();
        const secretary = volunteers.data.find(v => v.email === 'secretary2023@swhoab.com');
        
        if (secretary) {
            const assignments = await client.models.Assignment.list({
                filter: { volunteerId: { eq: secretary.id } }
            });
            
            const homeIds = homes.data.map(h => h.id);
            const assignmentsForThisAddress = assignments.data.filter(a => homeIds.includes(a.homeId));
            
            console.log(`Assignments for this address: ${assignmentsForThisAddress.length}`);
            assignmentsForThisAddress.forEach((assignment, index) => {
                console.log(`  ${index + 1}. Assignment ID: ${assignment.id}, Home ID: ${assignment.homeId}`);
            });
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkSpecificAddress();