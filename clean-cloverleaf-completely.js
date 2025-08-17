import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function cleanCloverleafCompletely() {
    console.log('🧹 COMPLETE CLOVERLEAF CLEANUP - REMOVING ALL DUPLICATES AND TEST DATA\n');
    
    try {
        // Step 1: Get all people and identify Cloverleaf residents
        console.log('1. 📊 Loading all residents...');
        const allPeople = await client.models.Person.list({ limit: 10000 });
        console.log(`Found ${allPeople.data?.length || 0} total residents`);
        
        // Step 2: Get all Cloverleaf homes
        console.log('\n2. 🏠 Loading all Cloverleaf homes...');
        const cloverleafHomes = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } },
            limit: 1000
        });
        console.log(`Found ${cloverleafHomes.data?.length || 0} Cloverleaf homes`);
        
        const cloverleafHomeIds = cloverleafHomes.data.map(h => h.id);
        
        // Step 3: Find all residents in Cloverleaf homes
        const cloverleafResidents = allPeople.data.filter(person => 
            cloverleafHomeIds.includes(person.homeId)
        );
        
        console.log(`\n3. 👥 Found ${cloverleafResidents.length} residents in Cloverleaf homes:`);
        
        // Group by home address for analysis
        const residentsByHome = {};
        for (const resident of cloverleafResidents) {
            const home = cloverleafHomes.data.find(h => h.id === resident.homeId);
            const address = home?.street || 'Unknown';
            
            if (!residentsByHome[address]) {
                residentsByHome[address] = [];
            }
            residentsByHome[address].push(resident);
        }
        
        // Show current state
        for (const [address, residents] of Object.entries(residentsByHome)) {
            console.log(`\n${address}: ${residents.length} residents`);
            residents.forEach(r => {
                console.log(`  - ${r.firstName} ${r.lastName} (${r.role}) ID: ${r.id}`);
            });
        }
        
        // Step 4: DELETE ALL CLOVERLEAF RESIDENTS (fresh start)
        console.log(`\n4. 🗑️ DELETING ALL ${cloverleafResidents.length} CLOVERLEAF RESIDENTS...`);
        
        for (const resident of cloverleafResidents) {
            try {
                await client.models.Person.delete({ id: resident.id });
                console.log(`  🗑️ Deleted ${resident.firstName} ${resident.lastName} (${resident.role})`);
            } catch (error) {
                console.log(`  ❌ Failed to delete ${resident.firstName} ${resident.lastName}: ${error.message}`);
            }
        }
        
        // Step 5: Also delete test residents by name patterns
        console.log('\n5. 🧪 Deleting test residents across entire database...');
        
        const testPatterns = ['Test', 'Manual', 'Debug', 'Sample'];
        const testResidents = allPeople.data.filter(person => 
            testPatterns.some(pattern => 
                person.firstName?.includes(pattern) || 
                person.lastName?.includes(pattern)
            )
        );
        
        console.log(`Found ${testResidents.length} test residents to delete:`);
        for (const resident of testResidents) {
            try {
                await client.models.Person.delete({ id: resident.id });
                console.log(`  🗑️ Deleted test resident: ${resident.firstName} ${resident.lastName}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete test resident: ${error.message}`);
            }
        }
        
        // Step 6: CREATE CLEAN RESIDENTS - ONE RECORD PER PERSON
        console.log('\n6. ✨ Creating clean resident records...');
        
        const cleanResidents = [
            // 42927 Cloverleaf Ct - Simpsons
            { address: '42927 Cloverleaf Ct', firstName: 'Michael', lastName: 'Simpson', role: 'PRIMARY_OWNER' },
            { address: '42927 Cloverleaf Ct', firstName: 'Oya', lastName: 'Simpson', role: 'SECONDARY_OWNER' },
            
            // 42931 Cloverleaf Ct - Williams  
            { address: '42931 Cloverleaf Ct', firstName: 'Luther', lastName: 'Williams', role: 'PRIMARY_OWNER' },
            { address: '42931 Cloverleaf Ct', firstName: 'Rebecca', lastName: 'Williams', role: 'SECONDARY_OWNER' },
            
            // 42919 Cloverleaf Ct - Does
            { address: '42919 Cloverleaf Ct', firstName: 'John', lastName: 'Doe', role: 'PRIMARY_OWNER' },
            { address: '42919 Cloverleaf Ct', firstName: 'Jane', lastName: 'Doe', role: 'SECONDARY_OWNER' },
            
            // 42942 Cloverleaf Ct - Smiths
            { address: '42942 Cloverleaf Ct', firstName: 'Bob', lastName: 'Smith', role: 'PRIMARY_OWNER' },
            { address: '42942 Cloverleaf Ct', firstName: 'Alice', lastName: 'Smith', role: 'SECONDARY_OWNER' }
        ];
        
        for (const resident of cleanResidents) {
            // Find the home for this address
            const home = cloverleafHomes.data.find(h => h.street === resident.address);
            
            if (!home) {
                console.log(`  ❌ No home found for ${resident.address}`);
                continue;
            }
            
            try {
                await client.models.Person.create({
                    homeId: home.id,
                    firstName: resident.firstName,
                    lastName: resident.lastName,
                    role: resident.role,
                    hasSigned: false
                });
                console.log(`  ✅ Created ${resident.firstName} ${resident.lastName} at ${resident.address}`);
            } catch (error) {
                console.log(`  ❌ Failed to create ${resident.firstName} ${resident.lastName}: ${error.message}`);
            }
        }
        
        // Step 7: Verification - wait and check
        console.log('\n7. ⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n8. ✅ VERIFICATION:');
        console.log('═══════════════════════════════════════════');
        
        // Reload and check
        const newPeople = await client.models.Person.list({ limit: 10000 });
        const newCloverleafResidents = newPeople.data.filter(person => 
            cloverleafHomeIds.includes(person.homeId)
        );
        
        const newResidentsByHome = {};
        for (const resident of newCloverleafResidents) {
            const home = cloverleafHomes.data.find(h => h.id === resident.homeId);
            const address = home?.street || 'Unknown';
            
            if (!newResidentsByHome[address]) {
                newResidentsByHome[address] = [];
            }
            newResidentsByHome[address].push(resident);
        }
        
        for (const [address, residents] of Object.entries(newResidentsByHome)) {
            console.log(`\n${address}: ${residents.length} residents`);
            residents.forEach(r => {
                console.log(`  - ${r.firstName} ${r.lastName} (${r.role})`);
            });
        }
        
        console.log('\n🎉 CLEANUP COMPLETE!');
        console.log('Each Cloverleaf address should now have exactly 2 residents with no duplicates.');
        console.log('The canvassing page should show clean data.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

cleanCloverleafCompletely();