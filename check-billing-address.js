import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkBillingAddress() {
    console.log('🔍 CHECKING ABSENTEE OWNER BILLING ADDRESSES\n');
    
    try {
        // Get some absentee residents to see their data structure
        const residents = await client.models.Resident.list({ limit: 1000 });
        const absenteeResidents = residents.data.filter(r => r.isAbsentee === true).slice(0, 3);
        
        console.log('Sample Absentee Residents:');
        absenteeResidents.forEach(resident => {
            console.log('\n-------------------');
            console.log(`Name: ${resident.firstName} ${resident.lastName}`);
            console.log(`Is Absentee: ${resident.isAbsentee}`);
            console.log(`Occupant Type: ${resident.occupantType}`);
            console.log('\nAvailable fields:');
            Object.keys(resident).forEach(key => {
                if (resident[key] && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
                    console.log(`  ${key}: ${resident[key]}`);
                }
            });
        });
        
        // Check the CSV data to see what fields we have
        console.log('\n\nChecking CSV structure for billing address...');
        const csvData = readFileSync('./.data/Homeowner2.csv', 'utf8');
        const lines = csvData.split('\n').slice(0, 5);
        
        console.log('\nFirst few lines of Homeowner2.csv:');
        lines.forEach((line, i) => {
            if (i === 0) console.log('\nHeader or first row:');
            const parts = line.split('|');
            if (parts.length >= 3) {
                console.log(`Property: ${parts[0]}`);
                console.log(`Owner Key: ${parts[1]}`);
                const details = parts[2].split(',');
                console.log('Owner details fields:');
                details.forEach((field, index) => {
                    if (field.trim()) {
                        console.log(`  [${index}]: ${field.trim()}`);
                    }
                });
            }
            console.log('---');
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkBillingAddress();