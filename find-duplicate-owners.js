import fs from 'fs';

// Read and parse CSV
const csv = fs.readFileSync('./.data/residents.csv', 'utf8');
const lines = csv.split('\n').filter(line => line.trim());

// Skip header and parse residents
const residents = [];
for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 8) {
        const firstName = parts[1].replace(/"/g, '');
        const lastName = parts[2].replace(/"/g, '');
        const street = parts[4].replace(/"/g, '');
        const city = parts[5].replace(/"/g, '');
        residents.push({
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            address: `${street}, ${city}`
        });
    }
}

// Group by name
const nameGroups = {};
residents.forEach(r => {
    if (!nameGroups[r.fullName]) {
        nameGroups[r.fullName] = new Set();
    }
    nameGroups[r.fullName].add(r.address);
});

// Find people with multiple addresses
const multipleAddresses = [];
for (const [name, addresses] of Object.entries(nameGroups)) {
    if (addresses.size > 1) {
        multipleAddresses.push({
            name,
            addresses: Array.from(addresses)
        });
    }
}

// Sort by number of addresses
multipleAddresses.sort((a, b) => b.addresses.length - a.addresses.length);

console.log(`Found ${multipleAddresses.length} people with multiple addresses:\n`);

// Show top 20
multipleAddresses.slice(0, 20).forEach(person => {
    console.log(`${person.name}:`);
    person.addresses.forEach(addr => {
        console.log(`  - ${addr}`);
    });
    console.log();
});