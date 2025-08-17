import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function investigateMissingAssignments() {
    console.log('🔍 INVESTIGATING MISSING ASSIGNMENTS\n');
    
    try {
        // Get secretary volunteer
        const volunteers = await client.models.Volunteer.list();
        const secretary = volunteers.data.find(v => v.email === 'secretary2023@swhoab.com');
        
        console.log(`Secretary Simpson ID: ${secretary.id}\n`);
        
        // Get ALL assignments for secretary (including completed, cancelled, etc)
        const allAssignments = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretary.id } }
        });
        
        console.log(`📋 TOTAL ASSIGNMENTS: ${allAssignments.data.length}`);
        
        // Break down by status
        const statusBreakdown = {};
        allAssignments.data.forEach(a => {
            statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
        });
        
        console.log('\nStatus breakdown:');
        Object.entries(statusBreakdown).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
        });
        
        // Show all assignments with details
        console.log('\n📋 ALL ASSIGNMENTS DETAILS:');
        
        const assignmentDetails = [];
        for (const assignment of allAssignments.data) {
            try {
                const home = await client.models.Home.get({ id: assignment.homeId });
                const detail = {
                    id: assignment.id,
                    status: assignment.status,
                    address: home.data ? home.data.street : 'Home not found',
                    homeId: assignment.homeId,
                    createdAt: assignment.createdAt,
                    updatedAt: assignment.updatedAt
                };
                assignmentDetails.push(detail);
            } catch (error) {
                assignmentDetails.push({
                    id: assignment.id,
                    status: assignment.status,
                    address: `Error: ${error.message}`,
                    homeId: assignment.homeId,
                    createdAt: assignment.createdAt,
                    updatedAt: assignment.updatedAt
                });
            }
        }
        
        // Sort by creation date
        assignmentDetails.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        assignmentDetails.forEach((detail, index) => {
            console.log(`${index + 1}. [${detail.status}] ${detail.address}`);
            console.log(`   Assignment ID: ${detail.id}`);
            console.log(`   Home ID: ${detail.homeId}`);
            console.log(`   Created: ${detail.createdAt}`);
            console.log(`   Updated: ${detail.updatedAt}`);
            console.log('');
        });
        
        // Check if there are assignments from previous sessions that might have been cleared
        console.log('🔍 CHECKING FOR RECENTLY DELETED ASSIGNMENTS...');
        
        // Look for patterns in creation dates
        const creationDates = assignmentDetails.map(d => new Date(d.createdAt));
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        
        const recentAssignments = assignmentDetails.filter(d => 
            new Date(d.createdAt) > yesterday
        );
        
        console.log(`\nAssignments created in last 24 hours: ${recentAssignments.length}`);
        
        if (recentAssignments.length < 17) {
            console.log('\n⚠️ POSSIBLE ISSUES:');
            console.log('1. Some assignments may have been deleted during database cleanup');
            console.log('2. Some assignments may have failed to create');
            console.log('3. Some assignments may be assigned to a different volunteer');
            
            // Check if there are any assignments with NULL or different volunteer IDs
            console.log('\n🔍 Checking for orphaned assignments...');
            
            const allAssignmentsAll = await client.models.Assignment.list({ limit: 1000 });
            console.log(`Total assignments in database: ${allAssignmentsAll.data.length}`);
            
            // Look for assignments without volunteer IDs or with different IDs
            const orphanedAssignments = allAssignmentsAll.data.filter(a => 
                !a.volunteerId || a.volunteerId !== secretary.id
            );
            
            console.log(`Assignments not assigned to Secretary Simpson: ${orphanedAssignments.length}`);
            
            if (orphanedAssignments.length > 0) {
                console.log('\nSample orphaned assignments:');
                for (let i = 0; i < Math.min(5, orphanedAssignments.length); i++) {
                    const assignment = orphanedAssignments[i];
                    try {
                        const home = await client.models.Home.get({ id: assignment.homeId });
                        console.log(`  ${assignment.status} - ${home.data?.street || 'Unknown'} (Volunteer: ${assignment.volunteerId || 'None'})`);
                    } catch (error) {
                        console.log(`  ${assignment.status} - Error loading home (Volunteer: ${assignment.volunteerId || 'None'})`);
                    }
                }
            }
        }
        
        console.log('\n💡 CONCLUSION:');
        if (allAssignments.data.length === 17) {
            console.log('✅ All 17 assignments exist in database');
            console.log('The issue may be with the canvassing map filtering logic');
        } else {
            console.log(`❌ Only ${allAssignments.data.length} assignments found, missing ${17 - allAssignments.data.length}`);
            console.log('Some assignments may have been lost during database cleanup');
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

investigateMissingAssignments();