import { readFileSync, writeFileSync } from 'fs';

// Read the CSV file
const csvData = readFileSync('./.data/Homeowner2.csv', 'utf8');
const lines = csvData.split('\n');

// Create a map of resident name -> billing address
const billingAddressMap = {};

lines.forEach((line, index) => {
    if (index === 0 || !line.trim()) return; // Skip header and empty lines
    
    const parts = line.split('|');
    if (parts.length < 3) return;
    
    const propertyAddress = parts[0];
    const ownerKey = parts[1];
    const details = parts[2].split(',');
    
    if (details.length >= 13) {
        const firstName = details[0].trim();
        const lastName = details[1].trim();
        const billingStreet = details[8].trim();
        const billingCity = details[9].trim();
        const billingState = details[10].trim();
        const billingZip = details[11].trim();
        
        if (firstName && lastName) {
            // Use both formats for better matching
            const key1 = `${firstName} ${lastName}`.toLowerCase();
            const key2 = `${lastName} ${firstName}`.toLowerCase();
            
            // Only store if billing address is different from property address
            const propertyKey = propertyAddress.toLowerCase().trim();
            const billingKey = billingStreet.toLowerCase().trim();
            
            if (billingStreet && billingCity) {
                const addressData = {
                    street: billingStreet,
                    city: billingCity,
                    state: billingState || 'VA',
                    zip: billingZip,
                    isDifferentFromProperty: propertyKey !== billingKey
                };
                
                // Store with both key formats for flexible lookup
                billingAddressMap[key1] = addressData;
                billingAddressMap[key2] = addressData;
            }
        }
    }
});

// Save to a JSON file
writeFileSync('./src/data/billingAddresses.json', JSON.stringify(billingAddressMap, null, 2));

console.log(`Created billing address map with ${Object.keys(billingAddressMap).length} entries`);
console.log('\nSample entries:');
Object.entries(billingAddressMap).slice(0, 5).forEach(([name, address]) => {
    console.log(`${name}: ${address.street}, ${address.city}, ${address.state} ${address.zip}`);
});