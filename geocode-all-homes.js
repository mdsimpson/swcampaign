import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import https from 'https';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

// Get your Google Maps API key from environment variable
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

async function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (result.status === 'OK' && result.results && result.results.length > 0) {
                        const location = result.results[0].geometry.location;
                        resolve({
                            lat: location.lat,
                            lng: location.lng,
                            formatted_address: result.results[0].formatted_address
                        });
                    } else {
                        reject(new Error(`Geocoding failed: ${result.status} - ${result.error_message || 'Unknown error'}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });
    });
}

async function geocodeAllHomes() {
    console.log('🌍 Starting to geocode all homes in the database...');
    
    if (!GOOGLE_MAPS_API_KEY) {
        console.error('❌ Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
        return;
    }
    
    console.log(`🔑 Using Google Maps API key: ${GOOGLE_MAPS_API_KEY.substring(0, 8)}...`);
    
    try {
        // Get all homes with pagination
        let allHomes = [];
        let nextToken = null;
        let pageCount = 0;
        
        console.log('📦 Loading all homes from database...');
        do {
            pageCount++;
            console.log(`Loading page ${pageCount}...`);
            
            const homesResult = await client.models.Home.list({
                limit: 1000,
                nextToken: nextToken
            });
            
            allHomes.push(...homesResult.data);
            nextToken = homesResult.nextToken;
            
        } while (nextToken);
        
        console.log(`📊 Total homes loaded: ${allHomes.length}`);
        
        // Group homes by unique address to avoid geocoding duplicates
        const addressGroups = new Map();
        
        for (const home of allHomes) {
            const fullAddress = `${home.street}, ${home.city}, ${home.state || 'VA'} ${home.postalCode || ''}`.trim();
            
            if (!addressGroups.has(fullAddress)) {
                addressGroups.set(fullAddress, []);
            }
            addressGroups.get(fullAddress).push(home);
        }
        
        console.log(`🗺️ Found ${addressGroups.size} unique addresses to geocode`);
        console.log(`📍 This will save ${allHomes.length - addressGroups.size} duplicate API calls`);
        
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 10;
        
        const uniqueAddresses = Array.from(addressGroups.keys());
        
        console.log(`\n🚀 Starting geocoding process...`);
        
        // Process in batches to respect rate limits
        for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
            const batch = uniqueAddresses.slice(i, i + batchSize);
            console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniqueAddresses.length/batchSize)}`);
            
            // Process batch sequentially to avoid overwhelming the API
            for (const address of batch) {
                const homes = addressGroups.get(address);
                processedCount++;
                
                try {
                    console.log(`🔍 [${processedCount}/${uniqueAddresses.length}] Geocoding: ${address}`);
                    
                    const coordinates = await geocodeAddress(address);
                    console.log(`✅ Found: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`);
                    
                    // Update all homes with this address
                    const updatePromises = homes.map(async (home) => {
                        try {
                            await client.models.Home.update({
                                id: home.id,
                                lat: coordinates.lat,
                                lng: coordinates.lng
                            });
                            return { success: true, id: home.id };
                        } catch (error) {
                            console.error(`  ❌ Failed to update home ${home.id}:`, error.message);
                            return { success: false, id: home.id, error: error.message };
                        }
                    });
                    
                    const results = await Promise.all(updatePromises);
                    const successful = results.filter(r => r.success).length;
                    const failed = results.filter(r => !r.success).length;
                    
                    console.log(`  💾 Updated ${successful} homes${failed > 0 ? `, ${failed} failed` : ''}`);
                    successCount++;
                    
                    // Rate limiting - Google allows 50 requests per second
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    errorCount++;
                    console.error(`❌ [${processedCount}/${uniqueAddresses.length}] Failed to geocode ${address}:`, error.message);
                    
                    // Longer delay on error to avoid hitting rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Progress update every 10 addresses
                if (processedCount % 10 === 0) {
                    const progress = (processedCount / uniqueAddresses.length * 100).toFixed(1);
                    console.log(`📈 Progress: ${progress}% (${successCount} success, ${errorCount} errors)`);
                }
            }
        }
        
        console.log(`\n🎉 Geocoding complete!`);
        console.log(`📊 Final stats:`);
        console.log(`  • Unique addresses processed: ${processedCount}`);
        console.log(`  • Successfully geocoded: ${successCount}`);
        console.log(`  • Failed: ${errorCount}`);
        console.log(`  • Success rate: ${(successCount / processedCount * 100).toFixed(1)}%`);
        console.log(`  • Total homes updated: ${allHomes.length}`);
        console.log(`\n🗺️ All homes should now have accurate coordinates from Google Maps!`);
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n⏹️ Process interrupted by user');
    process.exit(0);
});

geocodeAllHomes();