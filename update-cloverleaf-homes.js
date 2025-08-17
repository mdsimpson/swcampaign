import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function updateCloverleafHomes() {
    console.log('Updating Cloverleaf Court homes with coordinates...');
    
    try {
        // Get all homes and find Cloverleaf ones
        const homesResult = await client.models.Home.list();
        console.log(`Found ${homesResult.data.length} total homes`);
        
        const cloverleafHomes = homesResult.data.filter(h => 
            h.street && h.street.toLowerCase().includes('cloverleaf')
        );
        
        console.log(`Found ${cloverleafHomes.length} Cloverleaf homes:`);
        
        for (let i = 0; i < cloverleafHomes.length; i++) {
            const home = cloverleafHomes[i];
            console.log(`\n${i + 1}. ${home.street}, ${home.city}, ${home.state} ${home.postalCode || ''}`);
            console.log(`   Current coords: lat=${home.lat}, lng=${home.lng}`);
            
            if (home.lat && home.lng) {
                console.log('   ✅ Already has coordinates, skipping');
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
            
            console.log(`   Updating with coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            
            try {
                const updateResult = await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                });
                
                if (updateResult.data) {
                    console.log(`   ✅ Successfully updated ${home.street}`);
                    console.log(`   Updated coords: lat=${updateResult.data.lat}, lng=${updateResult.data.lng}`);
                } else {
                    console.log(`   ❌ Update failed for ${home.street}:`, updateResult.errors);
                }
                
            } catch (error) {
                console.error(`   ❌ Error updating ${home.street}:`, error.message);
            }
        }
        
        console.log('\n🎉 Cloverleaf update complete!');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

updateCloverleafHomes();