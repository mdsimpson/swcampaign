
// RESTORE INSTRUCTIONS
// To restore this backup, run the following in Node.js:

import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();
const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function restoreBackup() {
    const backup = JSON.parse(readFileSync('database-backup-2025-08-16.json', 'utf8'));
    
    console.log('Restoring backup from:', backup.metadata.timestamp);
    
    // Restore homes
    for (const home of backup.data.homes) {
        const { id, createdAt, updatedAt, ...homeData } = home;
        await client.models.Home.create(homeData);
    }
    
    // Restore people
    for (const person of backup.data.people) {
        const { id, createdAt, updatedAt, ...personData } = person;
        await client.models.Person.create(personData);
    }
    
    // Add other models as needed...
    
    console.log('Restore complete!');
}

restoreBackup();
