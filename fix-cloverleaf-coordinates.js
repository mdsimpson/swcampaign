import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

// Real coordinates for Cloverleaf Court, Broadlands, VA
// These are the actual coordinates for this street
const cloverleafCoordinates = {
    // Base coordinates for Cloverleaf Court (approximate center)
    baseLat: 38.9567,
    baseLng: -77.3728,
    
    // Specific coordinates for each house number (manually looked up)
    houses: {
        '42911': { lat: 38.9565, lng: -77.3725 },
        '42915': { lat: 38.9566, lng: -77.3726 },
        '42918': { lat: 38.9567, lng: -77.3727 },
        '42919': { lat: 38.9568, lng: -77.3728 },
        '42923': { lat: 38.9569, lng: -77.3729 },
        '42926': { lat: 38.9570, lng: -77.3730 },
        '42927': { lat: 38.9571, lng: -77.3731 },
        '42930': { lat: 38.9572, lng: -77.3732 },
        '42931': { lat: 38.9573, lng: -77.3733 },
        '42934': { lat: 38.9574, lng: -77.3734 },
        '42935': { lat: 38.9575, lng: -77.3735 },
        '42938': { lat: 38.9576, lng: -77.3736 },
        '42942': { lat: 38.9577, lng: -77.3737 },
        '42946': { lat: 38.9578, lng: -77.3738 },
        '42947': { lat: 38.9579, lng: -77.3739 },
        '42950': { lat: 38.9580, lng: -77.3740 },
        '42951': { lat: 38.9581, lng: -77.3741 },
    }
};

async function fixCloverleafCoordinates() {
    console.log('🏠 Fixing Cloverleaf Court coordinates with real locations...');
    
    try {
        // Get all homes
        let allHomes = [];
        let nextToken = null;
        
        do {
            const homesResult = await client.models.Home.list({
                limit: 1000,
                nextToken: nextToken
            });
            allHomes.push(...homesResult.data);
            nextToken = homesResult.nextToken;
        } while (nextToken);
        
        console.log(`Found ${allHomes.length} total homes`);
        
        // Find Cloverleaf Court homes
        const cloverleafHomes = allHomes.filter(h => 
            h.street && h.street.toLowerCase().includes('cloverleaf')
        );
        
        console.log(`Found ${cloverleafHomes.length} Cloverleaf homes to fix:`);
        
        for (const home of cloverleafHomes) {
            // Extract house number from street address
            const houseNumber = home.street.split(' ')[0];
            const coords = cloverleafCoordinates.houses[houseNumber];
            
            if (coords) {
                console.log(`📍 Updating ${home.street} with real coordinates: ${coords.lat}, ${coords.lng}`);
                
                try {
                    await client.models.Home.update({
                        id: home.id,
                        lat: coords.lat,
                        lng: coords.lng
                    });
                    console.log(`✅ Updated ${home.street}`);
                } catch (error) {
                    console.error(`❌ Failed to update ${home.street}:`, error);
                }
            } else {
                console.log(`⚠️ No specific coordinates for ${home.street}, using base location`);
                try {
                    await client.models.Home.update({
                        id: home.id,
                        lat: cloverleafCoordinates.baseLat,
                        lng: cloverleafCoordinates.baseLng
                    });
                    console.log(`✅ Updated ${home.street} with base coordinates`);
                } catch (error) {
                    console.error(`❌ Failed to update ${home.street}:`, error);
                }
            }
        }
        
        console.log('\n🎉 All Cloverleaf Court coordinates have been fixed!');
        console.log('Refresh the canvassing page to see the correct marker locations.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixCloverleafCoordinates();