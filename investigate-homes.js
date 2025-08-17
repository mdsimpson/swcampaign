import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function investigateHomes() {
    console.log('🔍 Investigating home and resident data...');
    
    try {
        // 1. Check Luther Williams' home
        console.log('\n1. 🔍 Checking Luther Williams home...');
        const lutherHomeResult = await client.models.Home.get({ 
            id: 'b54f3380-85c8-42b2-84fc-01d155d1ac52' 
        });
        
        if (lutherHomeResult.data) {
            console.log(`✅ Luther's home: ${lutherHomeResult.data.street}`);
            console.log(`   Coordinates: ${lutherHomeResult.data.lat}, ${lutherHomeResult.data.lng}`);
        } else {
            console.log('❌ Luther\'s home not found!');
        }
        
        // 2. Search more broadly for Cloverleaf addresses
        console.log('\n2. 🔍 Searching for all Cloverleaf addresses...');
        
        // Search for various patterns
        const searchPatterns = ['Cloverleaf', '42919', '42927', '42931', '42942'];
        
        for (const pattern of searchPatterns) {
            const results = await client.models.Home.list({
                filter: { street: { contains: pattern } }
            });
            
            console.log(`\n   Pattern "${pattern}": ${results.data?.length || 0} homes`);
            if (results.data?.length > 0) {
                results.data.forEach(home => {
                    console.log(`     ${home.street} (ID: ${home.id})`);
                });
            }
        }
        
        // 3. Get all residents and try to find the missing ones
        console.log('\n3. 👥 Loading all residents to find missing Simpson/Williams...');
        
        const allPeopleResult = await client.models.Person.list({ limit: 10000 });
        const allPeople = allPeopleResult.data || [];
        console.log(`Total residents loaded: ${allPeople.length}`);
        
        // Search by name parts
        const targetNames = [
            { first: 'Michael', last: 'Simpson' },
            { first: 'Oya', last: 'Simpson' },
            { first: 'Luther', last: 'Williams' },
            { first: 'Rebecca', last: 'Williams' }
        ];
        
        console.log('\nSearching for target residents:');
        for (const target of targetNames) {
            const matches = allPeople.filter(person => 
                (person.firstName?.toLowerCase().includes(target.first.toLowerCase()) ||
                 person.lastName?.toLowerCase().includes(target.last.toLowerCase()))
            );
            
            console.log(`\n   ${target.first} ${target.last}:`);
            if (matches.length > 0) {
                matches.forEach(person => {
                    console.log(`     ${person.firstName} ${person.lastName} - homeId: ${person.homeId} (${person.role})`);
                });
            } else {
                console.log(`     ❌ Not found`);
            }
        }
        
        // 4. Check if there are homes without street numbers (perhaps data issue)
        console.log('\n4. 🔍 Checking for potential data issues...');
        
        const homesWithoutNumbers = allPeople
            .map(person => person.homeId)
            .filter((homeId, index, arr) => arr.indexOf(homeId) === index) // unique homeIds
            .slice(0, 20); // Check first 20 unique home IDs
            
        console.log(`\nChecking homes for residents (first 20):`);
        for (const homeId of homesWithoutNumbers) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId });
                if (homeResult.data) {
                    const residents = allPeople.filter(p => p.homeId === homeId);
                    console.log(`   ${homeResult.data.street}: ${residents.length} residents`);
                    
                    // Check for Cloverleaf or target names
                    if (homeResult.data.street.includes('Cloverleaf') || 
                        residents.some(r => r.lastName === 'Simpson' || r.lastName === 'Williams')) {
                        console.log(`     🎯 MATCH! ${homeResult.data.street}`);
                        residents.forEach(r => {
                            console.log(`       ${r.firstName} ${r.lastName} (${r.role})`);
                        });
                    }
                }
            } catch (error) {
                console.log(`   ❌ Error loading home ${homeId}: ${error.message}`);
            }
        }
        
        // 5. Count total unique addresses
        console.log('\n5. 📊 Database statistics...');
        
        let allHomesCount = 0;
        let nextToken = null;
        
        do {
            const homesResult = await client.models.Home.list({
                limit: 1000,
                nextToken: nextToken
            });
            allHomesCount += homesResult.data.length;
            nextToken = homesResult.nextToken;
        } while (nextToken);
        
        console.log(`Total homes in database: ${allHomesCount}`);
        console.log(`Total residents in database: ${allPeople.length}`);
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

investigateHomes();