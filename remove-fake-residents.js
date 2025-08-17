import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function removeFakeResidents() {
    console.log('🧹 REMOVING FAKE RESIDENTS CREATED BY CLEANUP SCRIPTS\n');
    
    try {
        const allPeople = await client.models.Person.list({ limit: 10000 });
        
        // Target the specific fake residents we found
        const fakeResidents = allPeople.data.filter(person => {
            const fullName = `${person.firstName || ''} ${person.lastName || ''}`;
            
            // These are the exact fake residents from our cleanup scripts
            return fullName === 'Jane Doe' ||
                   fullName === 'John Doe' ||
                   fullName === 'Bob Smith' ||
                   fullName === 'Alice Smith' ||
                   fullName === 'Test Person' ||
                   person.firstName === 'Joe Smith (TEST)';
        });
        
        console.log(`Found ${fakeResidents.length} fake residents to remove:`);
        
        for (const resident of fakeResidents) {
            console.log(`• ${resident.firstName} ${resident.lastName} (${resident.role})`);
            console.log(`  Created: ${resident.createdAt}`);
            
            // Get the home address for context
            try {
                const home = await client.models.Home.get({ id: resident.homeId });
                if (home.data) {
                    console.log(`  Address: ${home.data.street}`);
                }
            } catch (error) {
                console.log(`  Address: Could not load`);
            }
        }
        
        console.log(`\n🗑️ Deleting ${fakeResidents.length} fake residents...`);
        
        for (const resident of fakeResidents) {
            try {
                await client.models.Person.delete({ id: resident.id });
                console.log(`✅ Deleted: ${resident.firstName} ${resident.lastName}`);
            } catch (error) {
                console.log(`❌ Failed to delete ${resident.firstName} ${resident.lastName}: ${error.message}`);
            }
        }
        
        console.log('\n⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify removal
        console.log('\n✅ VERIFICATION:');
        const updatedPeople = await client.models.Person.list({ limit: 10000 });
        const remainingFakes = updatedPeople.data.filter(person => {
            const fullName = `${person.firstName || ''} ${person.lastName || ''}`;
            return fullName === 'Jane Doe' ||
                   fullName === 'John Doe' ||
                   fullName === 'Bob Smith' ||
                   fullName === 'Alice Smith' ||
                   fullName === 'Test Person';
        });
        
        if (remainingFakes.length === 0) {
            console.log('🎉 All fake residents successfully removed!');
        } else {
            console.log(`⚠️ ${remainingFakes.length} fake residents still remain`);
        }
        
        console.log('\n🏠 Now you should only see real residents from your original Homeowners2.csv file');
        console.log('The canvassing page should show clean, authentic data');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

removeFakeResidents();