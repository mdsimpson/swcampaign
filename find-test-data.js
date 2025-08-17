import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function findTestData() {
    console.log('🔍 Searching for John Doe, Jane Doe, and other test data...\n');
    
    try {
        const allPeople = await client.models.Person.list({ limit: 10000 });
        
        const testPeople = allPeople.data.filter(person => {
            const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
            return fullName.includes('john doe') || fullName.includes('jane doe') || 
                   fullName.includes('test') || fullName.includes('sample') ||
                   fullName.includes('fake') || fullName.includes('demo') ||
                   fullName.includes('bob smith') || fullName.includes('alice smith');
        });
        
        console.log(`Found ${testPeople.length} suspicious test records:`);
        
        for (const person of testPeople) {
            console.log(`• ${person.firstName} ${person.lastName} (${person.role})`);
            console.log(`  ID: ${person.id}`);
            console.log(`  Home ID: ${person.homeId}`);
            console.log(`  Created: ${person.createdAt}`);
            
            // Find the home for this person
            try {
                const home = await client.models.Home.get({ id: person.homeId });
                if (home.data) {
                    console.log(`  Address: ${home.data.street}, ${home.data.city}`);
                }
            } catch (error) {
                console.log(`  Address: Could not load home`);
            }
            console.log('');
        }
        
        // Also check if these names appear in the original CSV
        console.log('📄 Checking if these names exist in the original CSV...');
        const csvContent = readFileSync('.data/Homeowner2.csv', 'utf8');
        
        const testNames = ['John Doe', 'Jane Doe', 'Bob Smith', 'Alice Smith', 'Test', 'Sample', 'Demo', 'Fake'];
        
        for (const testName of testNames) {
            if (csvContent.toLowerCase().includes(testName.toLowerCase())) {
                console.log(`⚠️ "${testName}" FOUND in original CSV file!`);
            } else {
                console.log(`✅ "${testName}" NOT in original CSV - this is injected test data`);
            }
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

findTestData();