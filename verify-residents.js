import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function verifyResidents() {
    console.log('🔍 Verifying residents exist...\n');
    
    try {
        // 1. Check all people directly by name
        console.log('1. 📊 Searching by name...');
        
        const targetNames = [
            { first: 'Michael', last: 'Simpson' },
            { first: 'Oya', last: 'Simpson' },
            { first: 'Luther', last: 'Williams' },
            { first: 'Rebecca', last: 'Williams' },
            { first: 'John', last: 'Doe' },
            { first: 'Jane', last: 'Doe' },
            { first: 'Bob', last: 'Smith' },
            { first: 'Alice', last: 'Smith' }
        ];
        
        for (const target of targetNames) {
            const results = await client.models.Person.list({
                filter: {
                    firstName: { eq: target.first },
                    lastName: { eq: target.last }
                }
            });
            
            console.log(`${target.first} ${target.last}: ${results.data?.length || 0} found`);
            if (results.data?.length > 0) {
                results.data.forEach(person => {
                    console.log(`  - ID: ${person.id}, homeId: ${person.homeId}, role: ${person.role}`);
                });
            }
        }
        
        // 2. Check total people count
        console.log('\n2. 📊 Total people count...');
        const totalPeople = await client.models.Person.list({ limit: 10000 });
        console.log(`Total people in database: ${totalPeople.data?.length}`);
        
        // 3. Check if person creation is working at all
        console.log('\n3. 🧪 Testing person creation...');
        
        try {
            const testPerson = await client.models.Person.create({
                homeId: '55d9b2b3-a92b-40c3-bd86-c08e0ae42070', // 42919 home
                firstName: 'Test',
                lastName: 'Person',
                role: 'OTHER',
                hasSigned: false
            });
            
            console.log(`✅ Test person created: ${testPerson.data.id}`);
            
            // Try to find it immediately
            const findTest = await client.models.Person.get({ id: testPerson.data.id });
            console.log(`✅ Test person found: ${findTest.data?.firstName} ${findTest.data?.lastName}`);
            
            // Delete test person
            await client.models.Person.delete({ id: testPerson.data.id });
            console.log(`✅ Test person deleted`);
            
        } catch (error) {
            console.log(`❌ Test person creation failed: ${error.message}`);
        }
        
        // 4. Check homes exist
        console.log('\n4. 🏠 Checking homes exist...');
        const homeIds = [
            '55d9b2b3-a92b-40c3-bd86-c08e0ae42070', // 42919
            '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // 42927
            'ea62cdc5-d680-4fde-88b7-a8825316fc0a', // 42931
            'f71db520-a55b-487f-95da-c8c8db31e00a'  // 42942
        ];
        
        for (const homeId of homeIds) {
            try {
                const home = await client.models.Home.get({ id: homeId });
                console.log(`✅ ${home.data?.street}: exists`);
            } catch (error) {
                console.log(`❌ ${homeId}: not found`);
            }
        }
        
        // 5. Try creating one resident manually and verify immediately
        console.log('\n5. 🧪 Manual resident creation test...');
        
        try {
            const manualResident = await client.models.Person.create({
                homeId: '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // 42927
                firstName: 'Manual',
                lastName: 'Test',
                role: 'PRIMARY_OWNER',
                hasSigned: false
            });
            
            console.log(`✅ Manual resident created: ${manualResident.data.id}`);
            
            // Wait a bit and check
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const checkManual = await client.models.Person.list({
                filter: { homeId: { eq: '362d06fc-7b70-434b-81a7-fb3bde43dd7f' } }
            });
            
            console.log(`Found ${checkManual.data?.length || 0} residents for 42927 after manual creation`);
            
            // Cleanup
            if (manualResident.data.id) {
                await client.models.Person.delete({ id: manualResident.data.id });
                console.log(`✅ Manual test resident deleted`);
            }
            
        } catch (error) {
            console.log(`❌ Manual resident creation failed: ${error.message}`);
        }
        
        console.log('\n🤔 DIAGNOSIS:');
        console.log('If person creation works but residents don\'t show up,');
        console.log('it suggests the data is being created but with different homeIds');
        console.log('or there\'s a DynamoDB consistency issue.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

verifyResidents();