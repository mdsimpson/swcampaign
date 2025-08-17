import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));

Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixAssignments() {
  console.log('Checking assignments and volunteers...');
  
  try {
    // Get all volunteers
    const volunteersResult = await client.models.Volunteer.list();
    console.log('Total volunteers:', volunteersResult.data.length);
    
    volunteersResult.data.forEach(volunteer => {
      console.log(`Volunteer: ${volunteer.displayName} (${volunteer.email})`);
      console.log(`  ID: ${volunteer.id}`);
      console.log(`  userSub: ${volunteer.userSub}`);
      console.log('---');
    });
    
    // Get all assignments
    const assignmentsResult = await client.models.Assignment.list();
    console.log('Total assignments:', assignmentsResult.data.length);
    
    assignmentsResult.data.forEach(assignment => {
      console.log(`Assignment: ${assignment.id}`);
      console.log(`  volunteerId: ${assignment.volunteerId}`);
      console.log(`  homeId: ${assignment.homeId}`);
      console.log(`  status: ${assignment.status}`);
      console.log('---');
    });
    
    // Find the correct volunteer for secretary2023@swhoab.com
    const secretaryVolunteer = volunteersResult.data.find(v => 
      v.email === 'secretary2023@swhoab.com' || 
      v.userSub === '74c8c448-e051-700f-02da-5ddb257c3862'
    );
    
    if (secretaryVolunteer) {
      console.log('Found secretary volunteer:', secretaryVolunteer);
      
      // Check if any assignments are incorrectly linked
      const secretaryAssignments = assignmentsResult.data.filter(a => 
        a.volunteerId === secretaryVolunteer.id
      );
      
      console.log(`Secretary has ${secretaryAssignments.length} assignments correctly linked`);
      
      // Check for orphaned assignments (assignments with wrong volunteer IDs)
      const orphanedAssignments = assignmentsResult.data.filter(a => 
        !volunteersResult.data.some(v => v.id === a.volunteerId)
      );
      
      console.log(`Found ${orphanedAssignments.length} orphaned assignments`);
      
      if (orphanedAssignments.length > 0) {
        console.log('Orphaned assignments:');
        orphanedAssignments.forEach(assignment => {
          console.log(`  Assignment ${assignment.id} has invalid volunteerId: ${assignment.volunteerId}`);
        });
      }
    } else {
      console.log('Secretary volunteer not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixAssignments();