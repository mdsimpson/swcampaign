import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkCurrentState() {
    console.log('🔍 Checking current database state for Cloverleaf addresses...\n');
    
    try {
        // 1. Get all Cloverleaf homes
        const cloverleafHomes = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } },
            limit: 1000
        });
        
        console.log(`📊 Found ${cloverleafHomes.data?.length || 0} homes with "Cloverleaf" in the address:\n`);
        
        // Group homes by address to find duplicates
        const homesByAddress = {};
        for (const home of cloverleafHomes.data) {
            if (!homesByAddress[home.street]) {
                homesByAddress[home.street] = [];
            }
            homesByAddress[home.street].push(home);
        }
        
        // Check each unique address
        for (const [address, homes] of Object.entries(homesByAddress)) {
            console.log(`\n🏠 ${address}: ${homes.length} home record(s)`);
            
            for (const home of homes) {
                console.log(`   ID: ${home.id}`);
                console.log(`   Coordinates: ${home.lat}, ${home.lng}`);
                
                // Get residents for this home
                const residents = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                });
                
                console.log(`   Residents (${residents.data?.length}):`);
                if (residents.data?.length > 0) {
                    residents.data.forEach(resident => {
                        console.log(`     - ${resident.firstName} ${resident.lastName} (${resident.role}) ID: ${resident.id}`);
                    });
                } else {
                    console.log(`     - No residents`);
                }
            }
        }
        
        // 2. Check for the specific addresses mentioned
        console.log('\n═══════════════════════════════════════════════════');
        console.log('CHECKING SPECIFIC ADDRESSES:');
        console.log('═══════════════════════════════════════════════════\n');
        
        const targetAddresses = ['42919', '42927', '42931', '42942'];
        
        for (const num of targetAddresses) {
            const homesWithNum = cloverleafHomes.data.filter(h => h.street.includes(num));
            console.log(`\n${num} Cloverleaf Ct:`);
            if (homesWithNum.length === 0) {
                console.log('  ❌ NOT FOUND');
            } else if (homesWithNum.length > 1) {
                console.log(`  ⚠️ DUPLICATE RECORDS (${homesWithNum.length} found)`);
                homesWithNum.forEach(h => console.log(`    - ID: ${h.id}`));
            } else {
                console.log(`  ✅ Found (ID: ${homesWithNum[0].id})`);
            }
        }
        
        // 3. Check volunteers and assignments
        console.log('\n═══════════════════════════════════════════════════');
        console.log('VOLUNTEERS & ASSIGNMENTS:');
        console.log('═══════════════════════════════════════════════════\n');
        
        const volunteers = await client.models.Volunteer.list();
        console.log(`Volunteers: ${volunteers.data?.length}`);
        volunteers.data?.forEach(v => {
            console.log(`  - ${v.displayName} (${v.email}) ID: ${v.id}`);
        });
        
        const assignments = await client.models.Assignment.list();
        console.log(`\nTotal Assignments: ${assignments.data?.length}`);
        
        // Check assignments for Cloverleaf homes
        const cloverleafHomeIds = cloverleafHomes.data.map(h => h.id);
        const cloverleafAssignments = assignments.data.filter(a => 
            cloverleafHomeIds.includes(a.homeId)
        );
        
        console.log(`Cloverleaf Assignments: ${cloverleafAssignments.length}`);
        cloverleafAssignments.forEach(a => {
            const home = cloverleafHomes.data.find(h => h.id === a.homeId);
            const volunteer = volunteers.data.find(v => v.id === a.volunteerId);
            console.log(`  - ${home?.street || a.homeId} -> ${volunteer?.displayName || a.volunteerId}`);
        });
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkCurrentState();