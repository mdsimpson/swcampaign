import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function removeTestResidents() {
    console.log('🧹 Removing test residents from database...\n');
    
    try {
        // Get all people
        console.log('1. 📊 Loading all residents...');
        const allPeople = await client.models.Person.list({ limit: 10000 });
        console.log(`Found ${allPeople.data?.length || 0} total residents`);
        
        // Find test residents by various patterns
        const testPatterns = [
            'Test',
            'Manual', 
            'Debug',
            'Sample',
            'Fake',
            'Demo'
        ];
        
        const testResidents = allPeople.data.filter(person => {
            const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
            return testPatterns.some(pattern => 
                fullName.includes(pattern.toLowerCase())
            );
        });
        
        console.log(`\n2. 🎯 Found ${testResidents.length} test residents to remove:`);
        testResidents.forEach(resident => {
            console.log(`  - ${resident.firstName} ${resident.lastName} (${resident.role}) ID: ${resident.id}`);
        });
        
        if (testResidents.length === 0) {
            console.log('✅ No test residents found. Database is clean!');
            return;
        }
        
        // Delete each test resident
        console.log(`\n3. 🗑️ Deleting ${testResidents.length} test residents...`);
        
        for (const resident of testResidents) {
            try {
                await client.models.Person.delete({ id: resident.id });
                console.log(`  ✅ Deleted: ${resident.firstName} ${resident.lastName}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete ${resident.firstName} ${resident.lastName}: ${error.message}`);
            }
        }
        
        // Wait for consistency
        console.log('\n4. ⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify they're gone
        console.log('\n5. ✅ Verification - checking for remaining test residents...');
        const updatedPeople = await client.models.Person.list({ limit: 10000 });
        const remainingTestResidents = updatedPeople.data.filter(person => {
            const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
            return testPatterns.some(pattern => 
                fullName.includes(pattern.toLowerCase())
            );
        });
        
        if (remainingTestResidents.length === 0) {
            console.log('🎉 Success! All test residents have been removed.');
        } else {
            console.log(`⚠️ ${remainingTestResidents.length} test residents still remain:`);
            remainingTestResidents.forEach(resident => {
                console.log(`  - ${resident.firstName} ${resident.lastName}`);
            });
        }
        
        console.log('\n✅ Cleanup complete! The canvassing page should no longer show test residents.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

removeTestResidents();