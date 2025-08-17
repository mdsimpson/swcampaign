import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function debugMissingMarkers() {
    console.log('🔍 DEBUGGING MISSING MARKERS\n');
    
    const missingAddresses = [
        '42919 Cloverleaf Ct',
        '42942 Cloverleaf Ct', 
        '42911 Cloverleaf Ct',
        '42938 Cloverleaf Ct'
    ];
    
    try {
        // Get secretary volunteer
        const volunteers = await client.models.Volunteer.list();
        const secretary = volunteers.data.find(v => v.email === 'secretary2023@swhoab.com');
        
        console.log(`Secretary ID: ${secretary.id}\n`);
        
        // Check each missing address
        for (const address of missingAddresses) {
            console.log(`🏠 Checking ${address}:`);
            
            // Search for homes with this address
            const homes = await client.models.Home.list({
                filter: { street: { eq: address } }
            });
            
            console.log(`  Found ${homes.data.length} home record(s):`);
            
            for (const home of homes.data) {
                console.log(`    Home ID: ${home.id}`);
                console.log(`    Coordinates: ${home.lat}, ${home.lng}`);
                console.log(`    Has coords: ${!!(home.lat && home.lng)}`);
                
                // Check if there are assignments for this home
                const assignments = await client.models.Assignment.list({
                    filter: { homeId: { eq: home.id } }
                });
                
                console.log(`    Total assignments: ${assignments.data.length}`);
                
                // Check assignments for secretary specifically
                const secretaryAssignments = assignments.data.filter(a => a.volunteerId === secretary.id);
                console.log(`    Secretary's assignments: ${secretaryAssignments.length}`);
                
                if (secretaryAssignments.length > 0) {
                    secretaryAssignments.forEach(a => {
                        console.log(`      - Status: ${a.status}, Created: ${a.createdAt}`);
                    });
                }
                
                // Check residents
                const residents = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                });
                
                console.log(`    Residents: ${residents.data.length}`);
                if (residents.data.length > 0) {
                    residents.data.forEach(r => {
                        console.log(`      - ${r.firstName} ${r.lastName} (${r.role})`);
                    });
                }
                
                console.log('');
            }
            
            if (homes.data.length === 0) {
                console.log(`  ❌ No home record found for ${address}`);
                
                // Search for similar addresses
                const similarHomes = await client.models.Home.list({
                    filter: { street: { contains: address.split(' ')[0] } }
                });
                
                console.log(`  🔍 Found ${similarHomes.data.length} similar addresses:`);
                similarHomes.data.forEach(h => {
                    if (h.street.includes('Cloverleaf')) {
                        console.log(`    - ${h.street}`);
                    }
                });
            }
            
            console.log('---\n');
        }
        
        // Also check what addresses DO have assignments for secretary
        console.log('📋 ALL ADDRESSES WITH SECRETARY ASSIGNMENTS:');
        const allAssignments = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretary.id } }
        });
        
        for (const assignment of allAssignments.data) {
            try {
                const home = await client.models.Home.get({ id: assignment.homeId });
                if (home.data) {
                    console.log(`✅ ${home.data.street} (${assignment.status}) - Coords: ${home.data.lat}, ${home.data.lng}`);
                }
            } catch (error) {
                console.log(`❌ Error loading home for assignment ${assignment.id}`);
            }
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

debugMissingMarkers();