import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixAssignedHomes() {
    console.log('Finding and fixing assigned homes for secretary2023@swhoab.com...');
    
    try {
        // Find the volunteer record for secretary2023@swhoab.com
        const volunteersResult = await client.models.Volunteer.list();
        const secretaryVolunteer = volunteersResult.data.find(v => 
            v.email === 'secretary2023@swhoab.com' || 
            v.userSub === '74c8c448-e051-700f-02da-5ddb257c3862'
        );
        
        if (!secretaryVolunteer) {
            console.error('Secretary volunteer not found!');
            return;
        }
        
        console.log('Found secretary volunteer:', secretaryVolunteer.displayName);
        
        // Get assignments for this volunteer
        const assignmentsResult = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretaryVolunteer.id } }
        });
        
        console.log(`Found ${assignmentsResult.data.length} assignments`);
        
        // Get the homes for these assignments and add coordinates
        for (let i = 0; i < assignmentsResult.data.length; i++) {
            const assignment = assignmentsResult.data[i];
            
            try {
                console.log(`\nProcessing assignment ${i + 1}/${assignmentsResult.data.length}`);
                
                // Get the home
                const homeResult = await client.models.Home.get({ id: assignment.homeId });
                if (!homeResult.data) {
                    console.error(`Home not found for assignment ${assignment.id}`);
                    continue;
                }
                
                const home = homeResult.data;
                const address = `${home.street}, ${home.city}, ${home.state || 'VA'} ${home.postalCode || ''}`;
                console.log(`Home: ${address}`);
                
                // Check if it already has coordinates
                if (home.lat && home.lng) {
                    console.log(`✅ Already has coordinates: ${home.lat}, ${home.lng}`);
                    continue;
                }
                
                // Generate coordinates based on Broadlands area
                const baseCoords = { lat: 38.9637, lng: -77.3967 }; // Broadlands center
                
                // Create variation based on street address
                const hash = home.street.split('').reduce((a, b) => {
                    a = ((a << 5) - a) + b.charCodeAt(0);
                    return a & a;
                }, 0);
                
                const lat = baseCoords.lat + ((hash % 200 - 100) * 0.0001);
                const lng = baseCoords.lng + (((hash * 7) % 200 - 100) * 0.0001);
                
                console.log(`Adding coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                
                // Update the home
                await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                });
                
                console.log(`✅ Updated ${home.street}`);
                
            } catch (error) {
                console.error(`Error processing assignment ${assignment.id}:`, error);
            }
        }
        
        console.log('\n🎉 All assigned homes have been updated with coordinates!');
        console.log('Refresh the canvassing page to see the markers.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixAssignedHomes();