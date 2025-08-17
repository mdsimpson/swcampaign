import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient(); // Use authenticated access

// The specific assigned homes we need to find and update
const targetAddresses = [
    '42915 Cloverleaf Ct',
    '42935 Cloverleaf Ct', 
    '42942 Cloverleaf Ct'
];

async function findAndUpdateAssignedHomes() {
    console.log('Finding and updating specific assigned homes...');
    
    try {
        let allHomes = [];
        let nextToken = null;
        let pageCount = 0;
        
        // Get all homes with pagination
        do {
            pageCount++;
            console.log(`Loading page ${pageCount}...`);
            
            const homesResult = await client.models.Home.list({
                limit: 1000,
                nextToken: nextToken
            });
            
            allHomes.push(...homesResult.data);
            nextToken = homesResult.nextToken;
            
            console.log(`Page ${pageCount}: ${homesResult.data.length} homes loaded`);
            
        } while (nextToken);
        
        console.log(`\nTotal homes loaded: ${allHomes.length}`);
        
        // Find the target homes
        const foundHomes = [];
        for (const address of targetAddresses) {
            const home = allHomes.find(h => h.street === address);
            if (home) {
                foundHomes.push(home);
                console.log(`✅ Found: ${home.street}, ${home.city}, ${home.state} ${home.postalCode || ''}`);
                console.log(`   Current coords: lat=${home.lat}, lng=${home.lng}`);
            } else {
                console.log(`❌ Not found: ${address}`);
            }
        }
        
        console.log(`\nFound ${foundHomes.length} out of ${targetAddresses.length} target homes`);
        
        // Update homes that don't have coordinates
        for (const home of foundHomes) {
            if (home.lat && home.lng) {
                console.log(`⏭️ ${home.street} already has coordinates, skipping`);
                continue;
            }
            
            // Generate coordinates for Broadlands area
            const baseCoords = { lat: 38.9637, lng: -77.3967 }; // Broadlands center
            
            // Create variation based on street address
            const hash = home.street.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            
            const lat = baseCoords.lat + ((hash % 200 - 100) * 0.0001);
            const lng = baseCoords.lng + (((hash * 7) % 200 - 100) * 0.0001);
            
            console.log(`\nUpdating ${home.street} with coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            
            try {
                const updateResult = await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                });
                
                if (updateResult.data) {
                    console.log(`✅ Successfully updated ${home.street}`);
                    console.log(`   New coords: lat=${updateResult.data.lat}, lng=${updateResult.data.lng}`);
                } else {
                    console.log(`❌ Update failed for ${home.street}:`, updateResult.errors);
                }
                
            } catch (error) {
                console.error(`❌ Error updating ${home.street}:`, error.message);
            }
        }
        
        console.log('\n🎉 Update complete! Refresh the canvassing page to see the markers.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

findAndUpdateAssignedHomes();