import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

// Coordinates for Broadlands, VA homes
// Looked up manually - these are approximate coordinates in the Broadlands area
const broadlandsCoordinates = {
    lat: 38.9637,  // Center of Broadlands
    lng: -77.3967
};

// Function to generate slight variations for different addresses
function getCoordinatesForAddress(street) {
    const baseLatLng = broadlandsCoordinates;
    
    // Create small variations based on street name/number to spread homes around
    const hash = street.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    
    const latOffset = (hash % 100) * 0.0001; // Small random offset
    const lngOffset = ((hash * 7) % 100) * 0.0001;
    
    return {
        lat: baseLatLng.lat + latOffset,
        lng: baseLatLng.lng + lngOffset
    };
}

async function addCoordinates() {
    console.log('Adding coordinates to homes...');
    
    try {
        // Get all homes
        const homesResult = await client.models.Home.list();
        console.log(`Found ${homesResult.data.length} total homes`);
        
        let updatedCount = 0;
        
        for (const home of homesResult.data) {
            // Skip homes that already have coordinates
            if (home.lat && home.lng) {
                console.log(`⏭️ Skipping ${home.street} - already has coordinates`);
                continue;
            }
            
            // Only update homes in Broadlands, VA (since that's our target area)
            if (home.city === 'Broadlands' && (home.state === 'VA' || !home.state)) {
                const coords = getCoordinatesForAddress(home.street);
                const fullAddress = `${home.street}, ${home.city}, ${home.state || 'VA'} ${home.postalCode || ''}`;
                
                console.log(`Updating ${fullAddress} with coordinates ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                
                try {
                    await client.models.Home.update({
                        id: home.id,
                        lat: coords.lat,
                        lng: coords.lng
                    });
                    updatedCount++;
                    console.log(`✅ Updated ${home.street}`);
                } catch (error) {
                    console.error(`❌ Failed to update ${home.street}:`, error);
                }
            } else {
                console.log(`⏭️ Skipping ${home.street} in ${home.city} - not in Broadlands, VA`);
            }
        }
        
        console.log(`\n✅ Coordinate update complete! Updated ${updatedCount} homes.`);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

addCoordinates();