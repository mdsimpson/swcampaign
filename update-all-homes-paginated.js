import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function updateAllHomesPaginated() {
    console.log('Updating ALL homes with pagination...');
    
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
        
        const homesWithoutCoords = allHomes.filter(h => !h.lat || !h.lng);
        console.log(`Homes without coordinates: ${homesWithoutCoords.length}`);
        
        if (homesWithoutCoords.length === 0) {
            console.log('All homes already have coordinates!');
            return;
        }
        
        let updatedCount = 0;
        
        for (let i = 0; i < homesWithoutCoords.length; i++) {
            const home = homesWithoutCoords[i];
            
            if (i % 100 === 0) {
                console.log(`\nProgress: ${i}/${homesWithoutCoords.length} (${((i/homesWithoutCoords.length)*100).toFixed(1)}%)`);
            }
            
            // Generate coordinates based on city
            let baseCoords;
            if (home.city === 'Broadlands') {
                baseCoords = { lat: 38.9637, lng: -77.3967 };
            } else if (home.city === 'Ashburn') {
                baseCoords = { lat: 39.0437, lng: -77.4874 };
            } else {
                baseCoords = { lat: 38.9637, lng: -77.3967 }; // Default
            }
            
            // Create variation based on street address
            const hash = (home.street || '').split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            
            const lat = baseCoords.lat + ((hash % 1000 - 500) * 0.0001);
            const lng = baseCoords.lng + (((hash * 7) % 1000 - 500) * 0.0001);
            
            try {
                await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                });
                
                updatedCount++;
                
                if (i % 10 === 0) {
                    process.stdout.write('.');
                }
                
            } catch (error) {
                console.error(`\nFailed to update ${home.street}:`, error.message);
            }
        }
        
        console.log(`\n\n🎉 Coordinate update complete!`);
        console.log(`Updated ${updatedCount} out of ${homesWithoutCoords.length} homes.`);
        console.log(`Total homes in database: ${allHomes.length}`);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

updateAllHomesPaginated();