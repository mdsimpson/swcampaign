import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the homeowner data
const homeownerPath = path.join(__dirname, '.data', 'Homeowner2.csv');
const data = fs.readFileSync(homeownerPath, 'utf8');

const lines = data.split('\n').filter(line => line.trim());
const headers = lines[0].split(',');

const firstNameIdx = headers.indexOf('Occupant First Name');
const lastNameIdx = headers.indexOf('Occupant Last Name');
const streetIdx = headers.indexOf('Street');
const typeIdx = headers.indexOf('Occupant Type');

console.log('Rows where Occupant First Name equals Occupant Last Name:');
console.log('=' .repeat(80));

let foundCount = 0;

for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line (handle quotes)
    const columns = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            columns.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    columns.push(current.trim());
    
    if (columns.length > Math.max(firstNameIdx, lastNameIdx, streetIdx, typeIdx)) {
        const firstName = columns[firstNameIdx] || '';
        const lastName = columns[lastNameIdx] || '';
        const street = columns[streetIdx] || '';
        const type = columns[typeIdx] || '';
        
        // Check if first name equals last name (case-insensitive)
        if (firstName && lastName && firstName.toLowerCase() === lastName.toLowerCase()) {
            foundCount++;
            console.log(`\nRow ${i}:`);
            console.log(`  First Name: "${firstName}"`);
            console.log(`  Last Name: "${lastName}"`);
            console.log(`  Address: ${street}`);
            console.log(`  Type: ${type}`);
            console.log(`  Full line: ${line.substring(0, 150)}${line.length > 150 ? '...' : ''}`);
        }
    }
}

console.log('\n' + '='.repeat(80));
console.log(`Total found: ${foundCount} rows where first name equals last name`);