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
    
    if (columns.length > Math.max(firstNameIdx, lastNameIdx)) {
        const firstName = columns[firstNameIdx] || '';
        const lastName = columns[lastNameIdx] || '';
        
        if (firstName && lastName && firstName === lastName) {
            foundCount++;
            console.log(`Row ${i + 1}: "${firstName}" === "${lastName}"`);
            console.log(`Full line: ${line}`);
            console.log('-'.repeat(80));
        }
    }
}

console.log(`\nTotal found: ${foundCount} rows where first name equals last name`);