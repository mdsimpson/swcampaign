import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function geocodeAllAddresses() {
    console.log('🌍 GEOCODING ALL ADDRESSES\n');
    
    // Note: This script requires Google Maps JavaScript API to be loaded
    // For now, we'll create the structure and note the requirements
    
    console.log('⚠️ IMPORTANT: Geocoding requires Google Maps JavaScript API');
    console.log('This script should be run in a browser environment or with Google Maps Node.js client\n');
    
    try {
        // Get all homes without coordinates
        console.log('Loading homes that need geocoding...');
        const allHomes = await client.models.Home.list({ limit: 10000 });
        
        const homesNeedingGeocode = allHomes.data.filter(home => 
            !home.lat || !home.lng || home.lat === 0 || home.lng === 0
        );
        
        console.log(`Found ${homesNeedingGeocode.length} homes that need geocoding out of ${allHomes.data.length} total homes`);
        
        if (homesNeedingGeocode.length === 0) {
            console.log('✅ All homes already have coordinates!');
            return;
        }
        
        console.log('\nHomes needing geocoding:');
        homesNeedingGeocode.slice(0, 10).forEach(home => {
            console.log(`  - ${home.street}, ${home.city}, ${home.state}`);
        });
        
        if (homesNeedingGeocode.length > 10) {
            console.log(`  ... and ${homesNeedingGeocode.length - 10} more`);
        }
        
        // Create a batch geocoding function for browser use
        const geocodingCode = `
// Copy this code into the browser console on your canvassing page
// where Google Maps is loaded, then run geocodeAllFromConsole()

async function geocodeAllFromConsole() {
    if (!window.google || !window.google.maps) {
        alert('Google Maps not loaded. Please go to the canvassing page first.');
        return;
    }
    
    const geocoder = new google.maps.Geocoder();
    const homesToGeocode = ${JSON.stringify(homesNeedingGeocode.slice(0, 50))};
    
    console.log('Starting geocoding of', homesToGeocode.length, 'homes...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < homesToGeocode.length; i++) {
        const home = homesToGeocode[i];
        const address = home.street + ', ' + home.city + ', ' + (home.state || 'VA');
        
        try {
            console.log('Geocoding ' + (i + 1) + '/' + homesToGeocode.length + ': ' + address);
            
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ 
                    address: address,
                    componentRestrictions: {
                        country: 'US',
                        administrativeArea: home.state || 'VA'
                    }
                }, (results, status) => {
                    if (status === 'OK' && results && results.length > 0) {
                        resolve(results[0]);
                    } else {
                        reject(new Error('Geocoding failed: ' + status));
                    }
                });
            });
            
            const location = result.geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            
            // Update in database via your app's client
            // You'll need to adapt this to your app's context
            console.log('✅ Found coordinates for', home.street, ':', lat.toFixed(6), lng.toFixed(6));
            successCount++;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            console.error('❌ Error geocoding', address, ':', error.message);
            errorCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log('Geocoding complete!', successCount, 'successful,', errorCount, 'failed');
}

// Run the geocoding
geocodeAllFromConsole();
`;
        
        console.log('\n📋 GEOCODING INSTRUCTIONS:');
        console.log('1. Go to your canvassing page (/canvass) where Google Maps is loaded');
        console.log('2. Open browser console (F12)');
        console.log('3. Copy and paste the following code:');
        console.log('\n' + '='.repeat(80));
        console.log(geocodingCode);
        console.log('='.repeat(80));
        
        // Also create a server-side batch update function
        console.log('\n\n💾 ALTERNATIVE: Manual coordinate updates');
        console.log('If you have coordinates from another source, you can update them like this:');
        console.log('await client.models.Home.update({ id: "home-id", lat: 38.9400, lng: -77.4100 });');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

geocodeAllAddresses();