import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixDuplicateAssignments() {
    console.log('🔧 FIXING DUPLICATE ASSIGNMENTS TO GET EXACTLY 17 UNIQUE ADDRESSES\n');
    
    try {
        // Get secretary volunteer
        const volunteers = await client.models.Volunteer.list();
        const secretary = volunteers.data.find(v => v.email === 'secretary2023@swhoab.com');
        
        console.log(`Secretary Simpson ID: ${secretary.id}\n`);
        
        // Get ALL assignments for secretary
        const allAssignments = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretary.id } }
        });
        
        console.log(`📋 Found ${allAssignments.data.length} total assignments`);
        
        // Group assignments by home address
        const assignmentsByAddress = {};
        
        for (const assignment of allAssignments.data) {
            try {
                const home = await client.models.Home.get({ id: assignment.homeId });
                if (home.data) {
                    const address = home.data.street;
                    
                    if (!assignmentsByAddress[address]) {
                        assignmentsByAddress[address] = [];
                    }
                    
                    assignmentsByAddress[address].push({
                        assignment,
                        home: home.data
                    });
                }
            } catch (error) {
                console.log(`❌ Failed to load home for assignment ${assignment.id}`);
            }
        }
        
        console.log(`\n📊 Assignments grouped by address:`);
        console.log(`Unique addresses: ${Object.keys(assignmentsByAddress).length}`);
        
        // Show duplicates
        const duplicateAddresses = Object.entries(assignmentsByAddress).filter(([address, assignments]) => assignments.length > 1);
        
        if (duplicateAddresses.length > 0) {
            console.log(`\n🔍 Found duplicate assignments for ${duplicateAddresses.length} addresses:`);
            
            for (const [address, assignments] of duplicateAddresses) {
                console.log(`\n${address}: ${assignments.length} assignments`);
                assignments.forEach((item, index) => {
                    console.log(`  ${index + 1}. Assignment ID: ${item.assignment.id}`);
                    console.log(`     Home ID: ${item.assignment.homeId}`);
                    console.log(`     Created: ${item.assignment.createdAt}`);
                    console.log(`     Coords: ${item.home.lat}, ${item.home.lng}`);
                });
            }
            
            // Keep only the most recent assignment for each address
            console.log(`\n🧹 Removing duplicate assignments (keeping most recent for each address)...`);
            
            const assignmentsToDelete = [];
            
            for (const [address, assignments] of duplicateAddresses) {
                // Sort by creation date (newest first)
                assignments.sort((a, b) => new Date(b.assignment.createdAt) - new Date(a.assignment.createdAt));
                
                // Keep the first (newest), delete the rest
                const toKeep = assignments[0];
                const toDelete = assignments.slice(1);
                
                console.log(`\n${address}:`);
                console.log(`  ✅ Keeping: ${toKeep.assignment.id} (${toKeep.assignment.createdAt})`);
                
                for (const item of toDelete) {
                    console.log(`  ❌ Deleting: ${item.assignment.id} (${item.assignment.createdAt})`);
                    assignmentsToDelete.push(item.assignment);
                }
            }
            
            // Delete duplicate assignments
            console.log(`\n🗑️ Deleting ${assignmentsToDelete.length} duplicate assignments...`);
            
            for (const assignment of assignmentsToDelete) {
                try {
                    await client.models.Assignment.delete({ id: assignment.id });
                    console.log(`  ✅ Deleted assignment ${assignment.id}`);
                } catch (error) {
                    console.log(`  ❌ Failed to delete assignment ${assignment.id}: ${error.message}`);
                }
            }
            
            // Wait for consistency
            console.log(`\n⏳ Waiting for database consistency...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify final count
            const finalAssignments = await client.models.Assignment.list({
                filter: { volunteerId: { eq: secretary.id } }
            });
            
            console.log(`\n✅ FINAL VERIFICATION:`);
            console.log(`Total assignments after cleanup: ${finalAssignments.data.length}`);
            
            // Count unique addresses
            const uniqueAddresses = new Set();
            for (const assignment of finalAssignments.data) {
                try {
                    const home = await client.models.Home.get({ id: assignment.homeId });
                    if (home.data) {
                        uniqueAddresses.add(home.data.street);
                    }
                } catch (error) {
                    console.log(`❌ Failed to verify home for assignment ${assignment.id}`);
                }
            }
            
            console.log(`Unique addresses: ${uniqueAddresses.size}`);
            console.log(`Expected: 17 unique addresses`);
            
            if (uniqueAddresses.size === 17) {
                console.log(`🎉 SUCCESS! Now have exactly 17 unique address assignments`);
            } else if (uniqueAddresses.size < 17) {
                console.log(`⚠️ Still missing ${17 - uniqueAddresses.size} addresses`);
            } else {
                console.log(`⚠️ Still have ${uniqueAddresses.size - 17} extra addresses`);
            }
            
        } else {
            console.log(`✅ No duplicate assignments found`);
            console.log(`All ${Object.keys(assignmentsByAddress).length} assignments are for unique addresses`);
        }
        
        console.log(`\n💡 NEXT STEPS:`);
        console.log(`1. Refresh the canvassing page`);
        console.log(`2. Check if you now see the correct number of markers`);
        console.log(`3. If still seeing wrong count, the issue may be coordinate overlapping or map filtering`);
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

fixDuplicateAssignments();