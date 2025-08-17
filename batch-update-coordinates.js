import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function batchUpdateCoordinates() {
    console.log('Batch updating ALL homes with coordinates...');
    
    try {
        let allHomes = [];
        let nextToken = null;
        let pageCount = 0;
        
        // Get all homes with pagination
        console.log('Loading all homes...');
        do {
            pageCount++;
            const homesResult = await client.models.Home.list({
                limit: 1000,
                nextToken: nextToken
            });
            
            allHomes.push(...homesResult.data);
            nextToken = homesResult.nextToken;
            
            if (pageCount % 2 === 0) {
                console.log(`Loaded ${pageCount} pages, ${allHomes.length} homes so far...`);
            }
            
        } while (nextToken);
        
        console.log(`\nTotal homes loaded: ${allHomes.length}`);
        
        const homesWithoutCoords = allHomes.filter(h => !h.lat || !h.lng);
        console.log(`Homes without coordinates: ${homesWithoutCoords.length}`);
        
        if (homesWithoutCoords.length === 0) {
            console.log('All homes already have coordinates!');
            return;
        }
        
        console.log(`\nStarting batch update of ${homesWithoutCoords.length} homes...`);
        
        let updatedCount = 0;
        const batchSize = 10; // Process in smaller batches
        
        for (let i = 0; i < homesWithoutCoords.length; i += batchSize) {
            const batch = homesWithoutCoords.slice(i, i + batchSize);
            
            console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(homesWithoutCoords.length/batchSize)} (homes ${i + 1}-${i + batch.length})`);
            
            // Process batch in parallel
            const updatePromises = batch.map(async (home) => {
                try {
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
                    
                    const result = await client.models.Home.update({
                        id: home.id,
                        lat: lat,
                        lng: lng
                    });
                    
                    if (result.data) {
                        return { success: true, address: home.street };
                    } else {
                        return { success: false, address: home.street, error: result.errors };
                    }
                    
                } catch (error) {
                    return { success: false, address: home.street, error: error.message };
                }
            });
            
            const results = await Promise.all(updatePromises);
            const successes = results.filter(r => r.success).length;
            const failures = results.filter(r => !r.success);
            
            updatedCount += successes;
            
            console.log(`  ✅ Updated ${successes}/${batch.length} homes in this batch`);
            if (failures.length > 0) {
                console.log(`  ❌ Failed: ${failures.length} homes`);
                failures.forEach(f => console.log(`    - ${f.address}: ${f.error}`));
            }
            
            // Progress indicator
            const progress = ((i + batch.length) / homesWithoutCoords.length * 100).toFixed(1);
            console.log(`  Progress: ${progress}% (${updatedCount}/${homesWithoutCoords.length} updated)`);
            
            // Small delay between batches to avoid overwhelming the API
            if (i + batchSize < homesWithoutCoords.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`\n🎉 Batch update complete!`);
        console.log(`Successfully updated ${updatedCount} out of ${homesWithoutCoords.length} homes.`);
        console.log(`Total homes in database: ${allHomes.length}`);
        console.log('Refresh the canvassing page to see all markers.');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

batchUpdateCoordinates();