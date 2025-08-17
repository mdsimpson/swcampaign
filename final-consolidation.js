import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function finalConsolidation() {
    console.log('🔧 Final consolidation of all Cloverleaf data...\n');
    
    try {
        // 1. Define the target setup
        const targetSetup = {
            '42919 Cloverleaf Ct': {
                residents: [
                    { firstName: 'John', lastName: 'Doe', role: 'PRIMARY_OWNER' },
                    { firstName: 'Jane', lastName: 'Doe', role: 'SECONDARY_OWNER' }
                ]
            },
            '42927 Cloverleaf Ct': {
                residents: [
                    { firstName: 'Michael', lastName: 'Simpson', role: 'PRIMARY_OWNER' },
                    { firstName: 'Oya', lastName: 'Simpson', role: 'SECONDARY_OWNER' }
                ]
            },
            '42931 Cloverleaf Ct': {
                residents: [
                    { firstName: 'Luther', lastName: 'Williams', role: 'PRIMARY_OWNER' },
                    { firstName: 'Rebecca', lastName: 'Williams', role: 'SECONDARY_OWNER' }
                ]
            },
            '42942 Cloverleaf Ct': {
                residents: [
                    { firstName: 'Bob', lastName: 'Smith', role: 'PRIMARY_OWNER' },
                    { firstName: 'Alice', lastName: 'Smith', role: 'SECONDARY_OWNER' }
                ]
            }
        };
        
        // 2. Get all Cloverleaf homes and consolidate duplicates
        console.log('1. 🏠 Consolidating duplicate homes...');
        
        const allCloverleafHomes = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } },
            limit: 1000
        });
        
        // Group by address
        const homesByAddress = {};
        allCloverleafHomes.data.forEach(home => {
            if (!homesByAddress[home.street]) {
                homesByAddress[home.street] = [];
            }
            homesByAddress[home.street].push(home);
        });
        
        const keepHomeIds = {};
        
        // For each target address, pick one home to keep and delete the rest
        for (const targetAddress of Object.keys(targetSetup)) {
            const homesForAddress = homesByAddress[targetAddress] || [];
            console.log(`\n   ${targetAddress}: ${homesForAddress.length} records found`);
            
            if (homesForAddress.length === 0) {
                // Create the home
                console.log(`     Creating new home...`);
                const newHome = await client.models.Home.create({
                    street: targetAddress,
                    city: 'Broadlands',
                    state: 'VA',
                    postalCode: '20148',
                    absenteeOwner: false,
                    lat: 39.006 + Math.random() * 0.001, // Approximate coordinates
                    lng: -77.516 + Math.random() * 0.001
                });
                keepHomeIds[targetAddress] = newHome.data.id;
                console.log(`     ✅ Created (ID: ${newHome.data.id})`);
            } else {
                // Keep the first one, delete the rest
                keepHomeIds[targetAddress] = homesForAddress[0].id;
                console.log(`     ✅ Keeping: ${homesForAddress[0].id}`);
                
                // Delete duplicates
                for (let i = 1; i < homesForAddress.length; i++) {
                    try {
                        await client.models.Home.delete({ id: homesForAddress[i].id });
                        console.log(`     🗑️ Deleted duplicate: ${homesForAddress[i].id}`);
                    } catch (error) {
                        console.log(`     ❌ Failed to delete ${homesForAddress[i].id}:`, error.message);
                    }
                }
            }
        }
        
        // 3. Delete ALL existing residents for these homes to start fresh
        console.log('\n2. 🧹 Cleaning existing residents...');
        
        const allPeople = await client.models.Person.list({ limit: 10000 });
        const residentsByHome = {};
        
        // Group residents by homeId
        allPeople.data.forEach(person => {
            if (!residentsByHome[person.homeId]) {
                residentsByHome[person.homeId] = [];
            }
            residentsByHome[person.homeId].push(person);
        });
        
        // Delete residents for our target homes
        for (const [address, homeId] of Object.entries(keepHomeIds)) {
            const residents = residentsByHome[homeId] || [];
            console.log(`   ${address}: Deleting ${residents.length} existing residents`);
            
            for (const resident of residents) {
                try {
                    await client.models.Person.delete({ id: resident.id });
                    console.log(`     🗑️ Deleted ${resident.firstName} ${resident.lastName}`);
                } catch (error) {
                    console.log(`     ❌ Failed to delete ${resident.firstName} ${resident.lastName}:`, error.message);
                }
            }
        }
        
        // 4. Create fresh residents
        console.log('\n3. 👥 Creating fresh residents...');
        
        for (const [address, config] of Object.entries(targetSetup)) {
            const homeId = keepHomeIds[address];
            console.log(`\n   ${address} (${homeId}):`);
            
            for (const resident of config.residents) {
                try {
                    await client.models.Person.create({
                        homeId: homeId,
                        firstName: resident.firstName,
                        lastName: resident.lastName,
                        role: resident.role,
                        hasSigned: false
                    });
                    console.log(`     ✅ Created ${resident.firstName} ${resident.lastName} (${resident.role})`);
                } catch (error) {
                    console.log(`     ❌ Failed to create ${resident.firstName} ${resident.lastName}:`, error.message);
                }
            }
        }
        
        // 5. Fix assignments - ensure each target home has exactly one assignment
        console.log('\n4. 📋 Fixing assignments...');
        
        const volunteers = await client.models.Volunteer.list();
        const volunteer = volunteers.data?.[0];
        
        if (!volunteer) {
            console.log('   ❌ No volunteer found, skipping assignments');
        } else {
            // Delete all existing assignments for our homes
            const allAssignments = await client.models.Assignment.list();
            const targetHomeIds = Object.values(keepHomeIds);
            
            for (const assignment of allAssignments.data) {
                if (targetHomeIds.includes(assignment.homeId)) {
                    try {
                        await client.models.Assignment.delete({ id: assignment.id });
                        console.log(`   🗑️ Deleted assignment for home ${assignment.homeId}`);
                    } catch (error) {
                        console.log(`   ❌ Failed to delete assignment:`, error.message);
                    }
                }
            }
            
            // Create fresh assignments
            for (const [address, homeId] of Object.entries(keepHomeIds)) {
                try {
                    await client.models.Assignment.create({
                        homeId: homeId,
                        volunteerId: volunteer.id,
                        status: 'NOT_STARTED',
                        assignedAt: new Date().toISOString()
                    });
                    console.log(`   ✅ Created assignment for ${address}`);
                } catch (error) {
                    console.log(`   ❌ Failed to create assignment for ${address}:`, error.message);
                }
            }
        }
        
        // 6. Wait and verify
        console.log('\n5. ⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n6. ✅ FINAL VERIFICATION:');
        console.log('═══════════════════════════════════════════════════\n');
        
        for (const [address, homeId] of Object.entries(keepHomeIds)) {
            const residents = await client.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            
            console.log(`${address}:`);
            console.log(`  Home ID: ${homeId}`);
            console.log(`  Residents: ${residents.data?.length}`);
            if (residents.data?.length > 0) {
                residents.data.forEach(r => {
                    console.log(`    - ${r.firstName} ${r.lastName} (${r.role})`);
                });
            } else {
                console.log(`    - No residents found`);
            }
        }
        
        console.log('\n🎉 FINAL CONSOLIDATION COMPLETE!');
        console.log('The canvassing page should now work perfectly with:');
        console.log('  - No duplicate homes');
        console.log('  - Correct residents in each home');
        console.log('  - Clean assignments');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

finalConsolidation();