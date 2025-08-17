import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'csv-parse/sync';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

function normalizePhone(s) {
    if (!s) return undefined;
    const d = s.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return s.trim()
}

async function geocodeAddress(address, geocoder) {
    return new Promise((resolve, reject) => {
        geocoder.geocode({ 
            address: address,
            componentRestrictions: {
                country: 'US',
                administrativeArea: 'VA'
            }
        }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
                const location = results[0].geometry.location;
                resolve({
                    lat: location.lat(),
                    lng: location.lng()
                });
            } else {
                reject(new Error(`Geocoding failed: ${status}`));
            }
        });
    });
}

async function clearDatabase() {
    console.log('🧹 STEP 1: Clearing existing database...\n');
    
    const models = ['Assignment', 'InteractionRecord', 'Consent', 'Person', 'Home'];
    
    for (const modelName of models) {
        console.log(`Clearing ${modelName} records...`);
        let deleted = 0;
        while (true) {
            const result = await client.models[modelName].list({ limit: 50 });
            if (!result.data || result.data.length === 0) break;
            
            for (const record of result.data) {
                try {
                    await client.models[modelName].delete({ id: record.id });
                    deleted++;
                } catch (error) {
                    console.log(`Failed to delete ${modelName}: ${error.message}`);
                }
            }
            
            if (deleted % 100 === 0 && deleted > 0) {
                console.log(`  Deleted ${deleted} ${modelName} records...`);
            }
        }
        console.log(`✅ Cleared ${deleted} ${modelName} records`);
    }
}

async function importFromCSV(csvPath) {
    console.log('\n🏠 STEP 2: Importing homes and residents from CSV...\n');
    
    if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found: ${csvPath}`);
    }
    
    const raw = fs.readFileSync(path.resolve(csvPath), 'utf8');
    const records = parse(raw, {columns: true, skip_empty_lines: true});
    
    console.log(`Found ${records.length} records in CSV`);
    
    // Group records by address
    const homeMap = new Map();
    
    for (const row of records) {
        const street = row['Street'] || '';
        if (!street) continue;
        
        const city = row['City'] || 'Ashburn';
        const state = row['State'] || 'VA';
        const postalCode = row['Zip'] || undefined;
        const mailingStreet = row['Billing Address Street'] || undefined;
        const mailingCity = row['Billing Address City'] || undefined;
        const mailingState = row['Billing Address State'] || undefined;
        const mailingPostalCode = row['Billing Address Zip Code'] || undefined;
        const absenteeOwner = Boolean(mailingStreet && mailingStreet.trim() && (mailingStreet !== street));
        
        const homeKey = `${street}|${city}|${state}`;
        
        if (!homeMap.has(homeKey)) {
            homeMap.set(homeKey, {
                home: {
                    street,
                    city,
                    state,
                    postalCode,
                    unitNumber: undefined,
                    mailingStreet,
                    mailingCity,
                    mailingState,
                    mailingPostalCode,
                    absenteeOwner
                },
                people: []
            });
        }
        
        // Add person to this home
        const firstName = row['Occupant First Name'];
        const lastName = row['Occupant Last Name'];
        const occupantType = row['Occupant Type'];
        
        if (firstName || lastName) {
            let role;
            
            if (occupantType === 'Official Owner') {
                role = 'PRIMARY_OWNER';
            } else if (occupantType === 'Official Co Owner') {
                role = 'SECONDARY_OWNER';
            } else if (occupantType && occupantType.toLowerCase().includes('renter')) {
                role = 'RENTER';
            } else {
                role = 'OTHER';
            }
            
            // Check for duplicates within this home
            const existing = homeMap.get(homeKey).people.find(p => 
                p.firstName === firstName && p.lastName === lastName
            );
            
            if (!existing) {
                homeMap.get(homeKey).people.push({
                    role,
                    firstName,
                    lastName,
                    email: row['Contact Email'] || row['Additional Email'] || undefined,
                    mobilePhone: normalizePhone(row['Cell Phone'] || row['Unit Phone'] || row['Work Phone'])
                });
            }
        }
    }
    
    let homes = 0, persons = 0;
    const homeEntries = Array.from(homeMap.values());
    
    console.log(`Creating ${homeEntries.length} unique homes...`);
    
    for (const {home, people} of homeEntries) {
        try {
            const {data: homeRecord} = await client.models.Home.create(home);
            if (!homeRecord) {
                console.error('Failed to create home:', home.street);
                continue;
            }
            homes++;
            
            // Create all people for this home
            for (const person of people) {
                await client.models.Person.create({
                    homeId: homeRecord.id,
                    ...person
                });
                persons++;
            }
            
            if (homes % 50 === 0) {
                console.log(`Created ${homes} homes, ${persons} residents so far...`);
            }
        } catch (error) {
            console.error('Failed to process home:', home.street, error);
        }
    }
    
    console.log(`✅ Import completed: ${homes} homes and ${persons} people`);
    return homeEntries.length;
}

async function geocodeHomes() {
    console.log('\n🌍 STEP 3: Geocoding all addresses...\n');
    
    // This requires Google Maps to be loaded, so we'll create a separate script for this
    console.log('⚠️ Geocoding requires running the geocode script separately with Google Maps loaded');
    console.log('You can run: node geocode-all-addresses.js');
}

async function createBackup() {
    console.log('\n💾 STEP 4: Creating database backup...\n');
    
    const homes = await client.models.Home.list({ limit: 10000 });
    const people = await client.models.Person.list({ limit: 10000 });
    
    const backup = {
        timestamp: new Date().toISOString(),
        homes: homes.data || [],
        people: people.data || []
    };
    
    const backupPath = `backup-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`Backup contains: ${backup.homes.length} homes, ${backup.people.length} residents`);
    
    return backupPath;
}

async function main() {
    console.log('🚀 FRESH START WORKFLOW\n');
    console.log('This will:');
    console.log('1. Clear all existing data');
    console.log('2. Import fresh data from Homeowners2.csv');
    console.log('3. Note geocoding requirements');
    console.log('4. Create a backup file\n');
    
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Usage: node fresh-start-workflow.js /path/to/Homeowners2.csv');
        process.exit(1);
    }
    
    try {
        // Step 1: Clear database
        await clearDatabase();
        
        // Step 2: Import from CSV
        await importFromCSV(csvPath);
        
        // Step 3: Note geocoding requirements
        await geocodeHomes();
        
        // Step 4: Create backup
        await createBackup();
        
        console.log('\n🎉 FRESH START COMPLETE!');
        console.log('\nNext steps:');
        console.log('1. Run geocoding: node geocode-all-addresses.js');
        console.log('2. Test the canvassing page for clean data');
        console.log('3. Create new assignments as needed');
        
    } catch (error) {
        console.error('💥 Error:', error);
        process.exit(1);
    }
}

main();