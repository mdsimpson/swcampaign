import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function createDatabaseBackup() {
    console.log('💾 CREATING DATABASE BACKUP\n');
    
    try {
        console.log('1. 🏠 Loading all homes...');
        const homes = await client.models.Home.list({ limit: 10000 });
        console.log(`Found ${homes.data?.length || 0} homes`);
        
        console.log('2. 👥 Loading all residents...');
        const people = await client.models.Person.list({ limit: 10000 });
        console.log(`Found ${people.data?.length || 0} residents`);
        
        console.log('3. 📋 Loading all assignments...');
        const assignments = await client.models.Assignment.list({ limit: 10000 });
        console.log(`Found ${assignments.data?.length || 0} assignments`);
        
        console.log('4. ✍️ Loading all consents...');
        const consents = await client.models.Consent.list({ limit: 10000 });
        console.log(`Found ${consents.data?.length || 0} consents`);
        
        console.log('5. 📝 Loading all interaction records...');
        const interactions = await client.models.InteractionRecord.list({ limit: 10000 });
        console.log(`Found ${interactions.data?.length || 0} interaction records`);
        
        console.log('6. 👤 Loading all volunteers...');
        const volunteers = await client.models.Volunteer.list({ limit: 10000 });
        console.log(`Found ${volunteers.data?.length || 0} volunteers`);
        
        // Create comprehensive backup
        const backup = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                description: 'Complete database backup for HOA dissolution campaign',
                recordCounts: {
                    homes: homes.data?.length || 0,
                    people: people.data?.length || 0,
                    assignments: assignments.data?.length || 0,
                    consents: consents.data?.length || 0,
                    interactions: interactions.data?.length || 0,
                    volunteers: volunteers.data?.length || 0
                }
            },
            data: {
                homes: homes.data || [],
                people: people.data || [],
                assignments: assignments.data || [],
                consents: consents.data || [],
                interactions: interactions.data || [],
                volunteers: volunteers.data || []
            }
        };
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const backupPath = `database-backup-${timestamp}.json`;
        
        console.log(`\n7. 💾 Writing backup to ${backupPath}...`);
        writeFileSync(backupPath, JSON.stringify(backup, null, 2));
        
        // Also create a CSV export of key data
        const csvPath = `homes-residents-${timestamp}.csv`;
        console.log(`8. 📊 Creating CSV export: ${csvPath}...`);
        
        let csvContent = 'Street,City,State,Zip,Resident_Name,Role,Email,Phone,Has_Signed,Absentee_Owner\n';
        
        for (const home of backup.data.homes) {
            const residents = backup.data.people.filter(p => p.homeId === home.id);
            
            if (residents.length === 0) {
                // Home with no residents
                csvContent += `"${home.street}","${home.city}","${home.state || 'VA'}","${home.postalCode || ''}","","","","","","${home.absenteeOwner || false}"\n`;
            } else {
                for (const resident of residents) {
                    const fullName = `${resident.firstName || ''} ${resident.lastName || ''}`.trim();
                    csvContent += `"${home.street}","${home.city}","${home.state || 'VA'}","${home.postalCode || ''}","${fullName}","${resident.role || ''}","${resident.email || ''}","${resident.mobilePhone || ''}","${resident.hasSigned || false}","${home.absenteeOwner || false}"\n`;
                }
            }
        }
        
        writeFileSync(csvPath, csvContent);
        
        // Create restore instructions
        const restoreScript = `
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
    const backup = JSON.parse(readFileSync('${backupPath}', 'utf8'));
    
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
`;
        
        writeFileSync(`restore-instructions-${timestamp}.js`, restoreScript);
        
        console.log('\n✅ BACKUP COMPLETE!');
        console.log(`📁 Files created:`);
        console.log(`   • ${backupPath} - Complete JSON backup`);
        console.log(`   • ${csvPath} - CSV export for spreadsheet use`);
        console.log(`   • restore-instructions-${timestamp}.js - Restore script`);
        
        console.log(`\n📊 BACKUP SUMMARY:`);
        console.log(`   • ${backup.metadata.recordCounts.homes} homes`);
        console.log(`   • ${backup.metadata.recordCounts.people} residents`);
        console.log(`   • ${backup.metadata.recordCounts.assignments} assignments`);
        console.log(`   • ${backup.metadata.recordCounts.consents} consents`);
        console.log(`   • ${backup.metadata.recordCounts.interactions} interactions`);
        console.log(`   • ${backup.metadata.recordCounts.volunteers} volunteers`);
        
        return {
            backupPath,
            csvPath,
            recordCounts: backup.metadata.recordCounts
        };
        
    } catch (error) {
        console.error('💥 Error creating backup:', error);
        throw error;
    }
}

createDatabaseBackup();