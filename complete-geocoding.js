import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = 'AIzaSyDE-i1XJlyn5E6CEQVDfP0Husa-VPth08k';
const BATCH_SIZE = 50; // Larger batches for faster processing
const DELAY_MS = 30; // Faster rate

async function geocodeAddress(address) {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return {
                lat: location.lat,
                lng: location.lng
            };
        } else {
            return { lat: '', lng: '' };
        }
    } catch (error) {
        return { lat: '', lng: '' };
    }
}

async function processAllAddresses() {
    const csvPath = path.join(__dirname, '.data', 'address.csv');
    let data = fs.readFileSync(csvPath, 'utf8');
    
    while (true) {
        const lines = data.split('\n').filter(line => line.trim());
        
        // Find addresses that need geocoding
        const addressesToProcess = [];
        const allLines = [lines[0]]; // Keep header
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            const parts = line.split(',');
            if (parts.length >= 7) {
                const lat = parts[5];
                const lng = parts[6];
                
                if (!lat || !lng || lat === '' || lng === '') {
                    // Parse address for geocoding
                    const match = line.match(/^(\d+),"([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
                    if (match) {
                        const [, id, street, city, state, zip] = match;
                        addressesToProcess.push({ 
                            id, street, city, state, zip, 
                            lineIndex: i,
                            originalLine: line 
                        });
                    }
                }
            }
        }
        
        if (addressesToProcess.length === 0) {
            console.log('All addresses have been geocoded!');
            break;
        }
        
        console.log(`Found ${addressesToProcess.length} addresses to geocode...`);
        
        // Process next batch
        const batchToProcess = addressesToProcess.slice(0, BATCH_SIZE);
        console.log(`Processing batch of ${batchToProcess.length} addresses`);
        
        // Geocode the batch
        const geocodedBatch = [];
        for (let i = 0; i < batchToProcess.length; i++) {
            const addr = batchToProcess[i];
            const fullAddress = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
            
            process.stdout.write(`\rGeocoding ${i + 1}/${batchToProcess.length}: ${addr.street}`);
            
            const coords = await geocodeAddress(fullAddress);
            geocodedBatch.push({
                ...addr,
                lat: coords.lat,
                lng: coords.lng
            });
            
            if (i < batchToProcess.length - 1) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }
        
        console.log(); // New line after progress
        
        // Update the data with geocoded results
        const updatedLines = [...lines];
        for (const geocoded of geocodedBatch) {
            const newLine = `${geocoded.id},"${geocoded.street}","${geocoded.city}","${geocoded.state}","${geocoded.zip}",${geocoded.lat},${geocoded.lng}`;
            updatedLines[geocoded.lineIndex] = newLine;
        }
        
        // Write updated data back to file
        data = updatedLines.join('\n');
        fs.writeFileSync(csvPath, data);
        
        const successCount = geocodedBatch.filter(addr => addr.lat && addr.lng).length;
        console.log(`Batch complete: ${successCount}/${batchToProcess.length} addresses geocoded successfully`);
        
        // Brief pause before next batch
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final count
    const finalLines = data.split('\n').filter(l => l.trim());
    let geocoded = 0;
    for (let i = 1; i < finalLines.length; i++) {
        const parts = finalLines[i].split(',');
        if (parts.length >= 7 && parts[5] && parts[6]) {
            geocoded++;
        }
    }
    
    console.log(`\nFinal result: ${geocoded}/${finalLines.length - 1} addresses geocoded`);
}

processAllAddresses().catch(console.error);