import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function updateAllMissingCoords() {
    console.log('Updating ALL homes that are missing coordinates...');
    
    try {
        // Get all homes with pagination
        let allHomes = [];
        let nextToken = null;
        let pageCount = 0;
        
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
        
        console.log(`Total homes loaded: ${allHomes.length}`);
        
        const homesWithoutCoords = allHomes.filter(h => !h.lat || !h.lng);
        console.log(`Found ${homesWithoutCoords.length} homes without coordinates`);
        
        let updatedCount = 0;
        
        for (let i = 0; i < homesWithoutCoords.length; i++) {
            const home = homesWithoutCoords[i];
            const address = `${home.street}, ${home.city}, ${home.state || 'VA'} ${home.postalCode || ''}`;
            
            console.log(`Updating ${i + 1}/${homesWithoutCoords.length}: ${address}`);
            
            // Generate coordinates - use different base coordinates for different areas
            let baseCoords;
            if (home.city === 'Broadlands') {
                baseCoords = { lat: 38.9637, lng: -77.3967 }; // Broadlands center
            } else if (home.city === 'Ashburn') {
                baseCoords = { lat: 39.0437, lng: -77.4874 }; // Ashburn center
            } else {
                baseCoords = { lat: 38.9637, lng: -77.3967 }; // Default to Broadlands
            }
            
            // Create variation based on street address
            const hash = home.street.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            
            const lat = baseCoords.lat + ((hash % 400 - 200) * 0.0001); // Wider spread
            const lng = baseCoords.lng + (((hash * 7) % 400 - 200) * 0.0001);
            
            try {
                await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                });
                
                updatedCount++;
                console.log(`✅ Updated with coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                
            } catch (error) {
                console.error(`❌ Failed to update ${home.street}:`, error);
            }
        }
        
        console.log(`\n🎉 Coordinate update complete! Updated ${updatedCount} out of ${homesWithoutCoords.length} homes.`);
        console.log('Refresh the canvassing page to see the markers.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

updateAllMissingCoords();