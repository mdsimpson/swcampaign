import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function debugSecretaryAssignments() {
    console.log('🔍 DEBUGGING SECRETARY SIMPSON ASSIGNMENTS\n');
    
    try {
        // Step 1: Find secretary2023@swhoab.com user
        const volunteers = await client.models.Volunteer.list();
        console.log(`Found ${volunteers.data.length} volunteers total`);
        
        const secretaryVolunteer = volunteers.data.find(v => 
            v.email === 'secretary2023@swhoab.com' || 
            v.displayName?.toLowerCase().includes('simpson') ||
            v.email?.toLowerCase().includes('simpson')
        );
        
        if (!secretaryVolunteer) {
            console.log('❌ Secretary Simpson volunteer record not found');
            console.log('Available volunteers:');
            volunteers.data.forEach(v => {
                console.log(`  - ${v.displayName} (${v.email})`);
            });
            return;
        }
        
        console.log(`✅ Found Secretary Simpson volunteer:`);
        console.log(`   Name: ${secretaryVolunteer.displayName}`);
        console.log(`   Email: ${secretaryVolunteer.email}`);
        console.log(`   ID: ${secretaryVolunteer.id}`);
        console.log(`   User Sub: ${secretaryVolunteer.userSub}`);
        
        // Step 2: Get all assignments for this volunteer
        const assignments = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretaryVolunteer.id } }
        });
        
        console.log(`\n📋 Found ${assignments.data.length} total assignments`);
        
        // Step 3: Analyze assignment status
        const byStatus = {};
        assignments.data.forEach(a => {
            byStatus[a.status] = (byStatus[a.status] || 0) + 1;
        });
        
        console.log('Assignment status breakdown:');
        Object.entries(byStatus).forEach(([status, count]) => {
            console.log(`  - ${status}: ${count}`);
        });
        
        // Step 4: Check active assignments (what should show on map)
        const activeAssignments = assignments.data.filter(a => a.status === 'NOT_STARTED');
        console.log(`\n🎯 Active assignments (NOT_STARTED): ${activeAssignments.length}`);
        
        // Step 5: Load homes for active assignments and check coordinates
        console.log('\n🏠 Checking homes for active assignments:');
        
        let homesWithCoords = 0;
        let homesWithoutCoords = 0;
        let homesNotFound = 0;
        
        for (const assignment of activeAssignments) {
            try {
                const home = await client.models.Home.get({ id: assignment.homeId });
                
                if (home.data) {
                    const hasCoords = home.data.lat && home.data.lng;
                    console.log(`${hasCoords ? '✅' : '❌'} ${home.data.street} - ${hasCoords ? `${home.data.lat}, ${home.data.lng}` : 'No coordinates'}`);
                    
                    if (hasCoords) {
                        homesWithCoords++;
                    } else {
                        homesWithoutCoords++;
                    }
                } else {
                    console.log(`❌ Home not found for assignment ${assignment.id}`);
                    homesNotFound++;
                }
            } catch (error) {
                console.log(`❌ Error loading home ${assignment.homeId}: ${error.message}`);
                homesNotFound++;
            }
        }
        
        // Step 6: Summary
        console.log('\n📊 SUMMARY:');
        console.log(`• Total assignments: ${assignments.data.length}`);
        console.log(`• Active assignments (NOT_STARTED): ${activeAssignments.length}`);
        console.log(`• Homes with coordinates (should show on map): ${homesWithCoords}`);
        console.log(`• Homes without coordinates (won't show on map): ${homesWithoutCoords}`);
        console.log(`• Homes not found/error: ${homesNotFound}`);
        
        if (homesWithoutCoords > 0) {
            console.log('\n🌍 Homes needing geocoding:');
            for (const assignment of activeAssignments) {
                try {
                    const home = await client.models.Home.get({ id: assignment.homeId });
                    if (home.data && (!home.data.lat || !home.data.lng)) {
                        console.log(`  - ${home.data.street}, ${home.data.city}, ${home.data.state}`);
                    }
                } catch (error) {
                    console.log(`  - [Error loading home for assignment ${assignment.id}]`);
                }
            }
        }
        
        console.log('\n💡 CONCLUSION:');
        if (homesWithCoords === 13) {
            console.log('The discrepancy is likely due to homes without coordinates.');
            console.log('Run geocoding to add coordinates for the missing homes.');
        } else {
            console.log('There may be other filtering issues in the canvassing map logic.');
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

debugSecretaryAssignments();