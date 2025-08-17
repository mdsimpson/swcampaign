import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function testCanvassingApproach() {
    console.log('🧪 Testing exact canvassing page approach...\n');
    
    try {
        // This is exactly what the canvassing page does
        console.log('1. 📊 Loading all people (canvassing page approach)...');
        const allPeopleResult = await client.models.Person.list({ limit: 10000 });
        const allPeople = allPeopleResult.data || [];
        console.log(`Loaded ${allPeople.length} total people`);
        
        // 2. Test the specific home IDs
        const targetHomeIds = [
            '55d9b2b3-a92b-40c3-bd86-c08e0ae42070', // 42919
            '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // 42927
            'ea62cdc5-d680-4fde-88b7-a8825316fc0a', // 42931
            'f71db520-a55b-487f-95da-c8c8db31e00a'  // 42942
        ];
        
        console.log('\n2. 🔍 Filtering people by homeId (canvassing page approach)...');
        
        for (const homeId of targetHomeIds) {
            // This is the exact filtering logic from the canvassing page
            const residents = allPeople
                .filter(person => person.homeId === homeId)
                .sort((a, b) => {
                    if (a.role === 'PRIMARY_OWNER') return -1
                    if (b.role === 'PRIMARY_OWNER') return 1
                    if (a.role === 'SECONDARY_OWNER') return -1
                    if (b.role === 'SECONDARY_OWNER') return 1
                    return 0
                });
            
            console.log(`\nHome ${homeId}: ${residents.length} residents`);
            residents.forEach(r => {
                console.log(`  - ${r.firstName} ${r.lastName} (${r.role})`);
            });
        }
        
        // 3. Create a resident and test immediately using this approach
        console.log('\n3. 🧪 Creating resident and testing with canvassing approach...');
        
        const newResident = await client.models.Person.create({
            homeId: '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // 42927
            firstName: 'Test',
            lastName: 'Resident',
            role: 'PRIMARY_OWNER',
            hasSigned: false
        });
        
        console.log(`✅ Created resident: ${newResident.data.id}`);
        
        // Reload all people (like the canvassing page would on refresh)
        console.log('Reloading all people...');
        const updatedPeopleResult = await client.models.Person.list({ limit: 10000 });
        const updatedPeople = updatedPeopleResult.data || [];
        
        // Filter for 42927 home
        const residents42927 = updatedPeople
            .filter(person => person.homeId === '362d06fc-7b70-434b-81a7-fb3bde43dd7f');
        
        console.log(`42927 Cloverleaf Ct now has ${residents42927.length} residents:`);
        residents42927.forEach(r => {
            console.log(`  - ${r.firstName} ${r.lastName} (${r.role})`);
        });
        
        // Clean up
        await client.models.Person.delete({ id: newResident.data.id });
        console.log('✅ Test resident deleted');
        
        // 4. Check what people exist with target names
        console.log('\n4. 🔍 People with target names in all database:');
        
        const targetNames = ['Simpson', 'Williams', 'Doe', 'Smith'];
        for (const lastName of targetNames) {
            const matches = allPeople.filter(p => p.lastName?.includes(lastName));
            console.log(`\n${lastName}: ${matches.length} found`);
            matches.forEach(p => {
                console.log(`  - ${p.firstName} ${p.lastName} (homeId: ${p.homeId})`);
            });
        }
        
        // 5. Summary for user
        console.log('\n5. 📊 SUMMARY FOR THE USER:');
        console.log('═══════════════════════════════════════════════════');
        
        if (residents42927.length > 0) {
            console.log('✅ The canvassing approach WORKS - residents were found!');
            console.log('✅ The canvassing page should show residents correctly.');
        } else {
            console.log('❌ Even the canvassing approach shows 0 residents.');
            console.log('❌ There may be a fundamental data issue.');
        }
        
        // Check if any residents exist for Cloverleaf homes
        const cloverleafResidents = allPeople.filter(p => 
            targetHomeIds.includes(p.homeId)
        );
        
        console.log(`\nTotal residents for all Cloverleaf homes: ${cloverleafResidents.length}`);
        if (cloverleafResidents.length === 0) {
            console.log('🚨 PROBLEM: No residents exist for any of the target homes.');
            console.log('🚨 This explains why the canvassing page shows empty popups.');
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

testCanvassingApproach();