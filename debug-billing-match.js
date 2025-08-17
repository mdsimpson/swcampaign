import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

// Load billing addresses
const billingAddresses = JSON.parse(readFileSync('./src/data/billingAddresses.json', 'utf8'));

async function debugBillingMatch() {
    console.log('🔍 DEBUGGING BILLING ADDRESS MATCHING\n');
    
    try {
        // Get some absentee residents
        const residents = await client.models.Resident.list({ limit: 1000 });
        const absenteeResidents = residents.data.filter(r => r.isAbsentee === true).slice(0, 10);
        
        console.log('Sample Absentee Residents and their billing address matches:');
        console.log('===========================================================\n');
        
        absenteeResidents.forEach(resident => {
            const fullName = `${resident.firstName} ${resident.lastName}`;
            const lookupKey = fullName.toLowerCase();
            const billingAddress = billingAddresses[lookupKey];
            
            console.log(`Resident: ${fullName}`);
            console.log(`  Lookup key: "${lookupKey}"`);
            console.log(`  Found in map: ${billingAddress ? 'YES' : 'NO'}`);
            
            if (billingAddress) {
                console.log(`  Billing: ${billingAddress.street}, ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zip}`);
            } else {
                // Try to find similar keys
                const similarKeys = Object.keys(billingAddresses).filter(key => 
                    key.includes(resident.lastName?.toLowerCase()) || 
                    key.includes(resident.firstName?.toLowerCase())
                );
                
                if (similarKeys.length > 0) {
                    console.log(`  Similar keys found in map:`);
                    similarKeys.slice(0, 3).forEach(key => {
                        console.log(`    - "${key}"`);
                    });
                }
            }
            
            console.log('');
        });
        
        // Show some billing address keys for comparison
        console.log('\nSample billing address keys from map:');
        console.log('======================================');
        Object.keys(billingAddresses).slice(0, 20).forEach(key => {
            console.log(`  "${key}"`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugBillingMatch();