import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixDuplicateHomes() {
    console.log('🏠 Finding and fixing duplicate home records...');
    
    try {
        // Load all homes
        let allHomes = [];
        let nextToken = null;
        
        console.log('📦 Loading all homes...');
        do {
            const homesResult = await client.models.Home.list({
                limit: 1000,
                nextToken: nextToken
            });
            allHomes.push(...homesResult.data);
            nextToken = homesResult.nextToken;
        } while (nextToken);
        
        console.log(`📊 Total homes loaded: ${allHomes.length}`);
        
        // Load all people
        console.log('👥 Loading all residents...');
        const peopleResult = await client.models.Person.list({ limit: 10000 });
        const allPeople = peopleResult.data || [];
        console.log(`👥 Total residents loaded: ${allPeople.length}`);
        
        // Load all assignments
        console.log('📋 Loading all assignments...');
        const assignmentsResult = await client.models.Assignment.list({ limit: 10000 });
        const allAssignments = assignmentsResult.data || [];
        console.log(`📋 Total assignments loaded: ${allAssignments.length}`);
        
        // Group homes by address
        const homesByAddress = new Map();
        allHomes.forEach(home => {
            const address = home.street.trim();
            if (!homesByAddress.has(address)) {
                homesByAddress.set(address, []);
            }
            homesByAddress.get(address).push(home);
        });
        
        // Find duplicates
        const duplicates = [];
        homesByAddress.forEach((homes, address) => {
            if (homes.length > 1) {
                duplicates.push({ address, homes });
            }
        });
        
        console.log(`🔍 Found ${duplicates.length} addresses with duplicate home records`);
        
        for (const duplicate of duplicates) {
            console.log(`\n🏠 Address: ${duplicate.address}`);
            console.log(`   📍 ${duplicate.homes.length} home records:`);
            
            // Show details for each duplicate
            const homeDetails = [];
            for (const home of duplicate.homes) {
                const residents = allPeople.filter(p => p.homeId === home.id);
                const assignments = allAssignments.filter(a => a.homeId === home.id);
                
                homeDetails.push({
                    home,
                    residents: residents.length,
                    assignments: assignments.length,
                    residentNames: residents.map(r => `${r.firstName} ${r.lastName}`).join(', ')
                });
                
                console.log(`     ID: ${home.id}`);
                console.log(`     Residents: ${residents.length} (${residents.map(r => `${r.firstName} ${r.lastName}`).join(', ')})`);
                console.log(`     Assignments: ${assignments.length}`);
            }
            
            // Find the "best" home record to keep (one with most residents/assignments)
            homeDetails.sort((a, b) => {
                // Priority: residents > assignments > creation date
                if (a.residents !== b.residents) return b.residents - a.residents;
                if (a.assignments !== b.assignments) return b.assignments - a.assignments;
                return new Date(b.home.createdAt) - new Date(a.home.createdAt);
            });
            
            const keepHome = homeDetails[0].home;
            const deleteHomes = homeDetails.slice(1).map(d => d.home);
            
            console.log(`   ✅ Keeping: ${keepHome.id} (${homeDetails[0].residents} residents, ${homeDetails[0].assignments} assignments)`);
            console.log(`   ❌ Will consolidate: ${deleteHomes.map(h => h.id).join(', ')}`);
            
            // Move residents and assignments to the kept home
            for (const deleteHome of deleteHomes) {
                const residentsToMove = allPeople.filter(p => p.homeId === deleteHome.id);
                const assignmentsToMove = allAssignments.filter(a => a.homeId === deleteHome.id);
                
                console.log(`   🔄 Moving ${residentsToMove.length} residents and ${assignmentsToMove.length} assignments from ${deleteHome.id} to ${keepHome.id}`);
                
                // Update residents
                for (const resident of residentsToMove) {
                    try {
                        await client.models.Person.update({
                            id: resident.id,
                            homeId: keepHome.id
                        });
                        console.log(`     ✅ Moved resident: ${resident.firstName} ${resident.lastName}`);
                    } catch (error) {
                        console.error(`     ❌ Failed to move resident ${resident.firstName} ${resident.lastName}:`, error.message);
                    }
                }
                
                // Update assignments
                for (const assignment of assignmentsToMove) {
                    try {
                        await client.models.Assignment.update({
                            id: assignment.id,
                            homeId: keepHome.id
                        });
                        console.log(`     ✅ Moved assignment: ${assignment.id}`);
                    } catch (error) {
                        console.error(`     ❌ Failed to move assignment ${assignment.id}:`, error.message);
                    }
                }
                
                // Delete the duplicate home record
                try {
                    await client.models.Home.delete({ id: deleteHome.id });
                    console.log(`     🗑️ Deleted duplicate home record: ${deleteHome.id}`);
                } catch (error) {
                    console.error(`     ❌ Failed to delete home ${deleteHome.id}:`, error.message);
                }
            }
        }
        
        console.log(`\n🎉 Duplicate home cleanup complete!`);
        console.log(`📊 Processed ${duplicates.length} duplicate addresses`);
        console.log(`🗑️ Consolidated duplicate home records`);
        console.log(`\n💡 Now reload the canvassing page to see the corrected data!`);
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

fixDuplicateHomes();