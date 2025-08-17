import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkMissingAddress() {
    console.log('🔍 CHECKING THE HOME ID FROM DEBUG SCRIPT\n');
    
    try {
        // From debug-map-display.js output: 42911 Cloverleaf Ct (2 residents)
        // Home ID: 09d00acd-5325-4826-a012-6464a3614517
        const homeId = '09d00acd-5325-4826-a012-6464a3614517';
        
        const home = await client.models.Home.get({ id: homeId });
        
        if (home.data) {
            console.log('✅ Found home record:');
            console.log(`   ID: ${home.data.id}`);
            console.log(`   Address: ${home.data.street}`);
            console.log(`   Coordinates: ${home.data.lat}, ${home.data.lng}`);
            console.log(`   Created: ${home.data.createdAt}`);
            
            // Check if this home has an assignment
            const volunteers = await client.models.Volunteer.list();
            const secretary = volunteers.data.find(v => v.email === 'secretary2023@swhoab.com');
            
            const assignments = await client.models.Assignment.list({
                filter: { 
                    and: [
                        { volunteerId: { eq: secretary.id } },
                        { homeId: { eq: homeId } }
                    ]
                }
            });
            
            console.log(`\nAssignments for this home: ${assignments.data.length}`);
            if (assignments.data.length > 0) {
                assignments.data.forEach((assignment, index) => {
                    console.log(`  ${index + 1}. Assignment ID: ${assignment.id}`);
                    console.log(`     Status: ${assignment.status}`);
                    console.log(`     Created: ${assignment.createdAt}`);
                });
            }
            
            // Check residents
            const residents = await client.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            
            console.log(`\nResidents: ${residents.data.length}`);
            residents.data.forEach((resident, index) => {
                console.log(`  ${index + 1}. ${resident.firstName} ${resident.lastName} (${resident.role})`);
            });
            
        } else {
            console.log('❌ Home record not found');
            
            // Search for homes with similar addresses
            console.log('\n🔍 Searching for homes with "42911" in the address...');
            
            const allHomes = await client.models.Home.list({ limit: 1000 });
            const matchingHomes = allHomes.data.filter(h => 
                h.street && h.street.includes('42911')
            );
            
            console.log(`Found ${matchingHomes.length} homes with "42911" in address:`);
            matchingHomes.forEach((home, index) => {
                console.log(`  ${index + 1}. ${home.street} - ID: ${home.id}`);
                console.log(`     Coords: ${home.lat}, ${home.lng}`);
            });
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkMissingAddress();