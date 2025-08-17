import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function findSecretary() {
    console.log('🔍 Finding secretary volunteer...');
    
    try {
        // Get all volunteers
        const volunteersResult = await client.models.Volunteer.list();
        console.log(`📋 Total volunteers: ${volunteersResult.data?.length || 0}`);
        
        console.log('\nAll volunteers:');
        volunteersResult.data.forEach(volunteer => {
            console.log(`  ${volunteer.displayName} - ${volunteer.email} (userSub: ${volunteer.userSub})`);
        });
        
        // Get all assignments to see which volunteer has Cloverleaf assignments
        const assignmentsResult = await client.models.Assignment.list();
        console.log(`\n📋 Total assignments: ${assignmentsResult.data?.length || 0}`);
        
        // Group assignments by volunteer
        const assignmentsByVolunteer = new Map();
        for (const assignment of assignmentsResult.data) {
            if (!assignmentsByVolunteer.has(assignment.volunteerId)) {
                assignmentsByVolunteer.set(assignment.volunteerId, []);
            }
            assignmentsByVolunteer.get(assignment.volunteerId).push(assignment);
        }
        
        console.log('\nAssignments by volunteer:');
        for (const [volunteerId, assignments] of assignmentsByVolunteer) {
            const volunteer = volunteersResult.data.find(v => v.id === volunteerId);
            const activeAssignments = assignments.filter(a => a.status === 'NOT_STARTED');
            console.log(`  ${volunteer?.displayName || 'Unknown'} (${volunteer?.email || 'No email'}): ${activeAssignments.length} active assignments`);
            
            // Check if any assignments are for Cloverleaf
            const cloverleafAssignments = [];
            for (const assignment of activeAssignments) {
                try {
                    const homeResult = await client.models.Home.get({ id: assignment.homeId });
                    if (homeResult.data?.street.includes('Cloverleaf')) {
                        cloverleafAssignments.push(homeResult.data.street);
                    }
                } catch (error) {
                    console.error(`    Error getting home for assignment ${assignment.id}:`, error.message);
                }
            }
            
            if (cloverleafAssignments.length > 0) {
                console.log(`    📍 Cloverleaf assignments: ${cloverleafAssignments.join(', ')}`);
            }
        }
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

findSecretary();