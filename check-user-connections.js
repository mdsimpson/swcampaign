import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkUserConnections() {
    console.log('🔍 CHECKING USER CONNECTIONS AND PROFILES\n');
    
    const targetUserId = '74c8c448-e051-700f-02da-5ddb257c3862';
    console.log(`Looking for user: ${targetUserId} (secretary2023@swhoab.com)\n`);
    
    try {
        // 1. Check UserProfiles
        console.log('1. Checking UserProfile table...');
        const userProfiles = await client.models.UserProfile.list({ limit: 1000 });
        console.log(`   Found ${userProfiles.data.length} user profiles:`);
        
        userProfiles.data.forEach(profile => {
            console.log(`   - sub: ${profile.sub}`);
            console.log(`     email: ${profile.email}`);
            console.log(`     name: ${profile.firstName} ${profile.lastName}`);
            console.log(`     roleCache: ${profile.roleCache}`);
            console.log('');
        });
        
        const matchingProfile = userProfiles.data.find(p => p.sub === targetUserId);
        if (matchingProfile) {
            console.log(`   ✅ Found matching profile for ${targetUserId}`);
        } else {
            console.log(`   ❌ No UserProfile found for ${targetUserId}`);
        }
        
        // 2. Check Volunteers
        console.log('\n2. Checking Volunteer table...');
        const volunteers = await client.models.Volunteer.list({ limit: 1000 });
        console.log(`   Found ${volunteers.data.length} volunteers:`);
        
        volunteers.data.forEach(volunteer => {
            console.log(`   - userSub: ${volunteer.userSub}`);
            console.log(`     displayName: ${volunteer.displayName}`);
            console.log(`     email: ${volunteer.email}`);
            console.log('');
        });
        
        const matchingVolunteer = volunteers.data.find(v => v.userSub === targetUserId);
        if (matchingVolunteer) {
            console.log(`   ✅ Found matching volunteer for ${targetUserId}`);
            console.log(`      Display Name: ${matchingVolunteer.displayName}`);
            console.log(`      Email: ${matchingVolunteer.email}`);
        } else {
            console.log(`   ❌ No Volunteer found for ${targetUserId}`);
        }
        
        // 3. Check Assignments to see who has assignments
        console.log('\n3. Checking Assignments to see which volunteers have assignments...');
        const assignments = await client.models.Assignment.list({ limit: 1000 });
        console.log(`   Found ${assignments.data.length} total assignments`);
        
        // Group assignments by volunteerId
        const assignmentsByVolunteer = {};
        assignments.data.forEach(assignment => {
            if (!assignmentsByVolunteer[assignment.volunteerId]) {
                assignmentsByVolunteer[assignment.volunteerId] = 0;
            }
            assignmentsByVolunteer[assignment.volunteerId]++;
        });
        
        console.log('\n   Assignments per volunteer:');
        Object.entries(assignmentsByVolunteer).forEach(([volunteerId, count]) => {
            const volunteer = volunteers.data.find(v => v.id === volunteerId);
            if (volunteer) {
                console.log(`   - ${volunteer.displayName || volunteer.email || volunteer.userSub}: ${count} assignments`);
                if (volunteer.userSub === targetUserId) {
                    console.log(`     ⭐ This is secretary2023@swhoab.com!`);
                }
            } else {
                console.log(`   - Unknown volunteer (${volunteerId}): ${count} assignments`);
            }
        });
        
        // 4. Check if we can find the secretary by email
        console.log('\n4. Looking for secretary2023@swhoab.com by email...');
        
        const secretaryProfile = userProfiles.data.find(p => 
            p.email === 'secretary2023@swhoab.com'
        );
        
        if (secretaryProfile) {
            console.log(`   ✅ Found UserProfile with email secretary2023@swhoab.com`);
            console.log(`      sub: ${secretaryProfile.sub}`);
            console.log(`      name: ${secretaryProfile.firstName} ${secretaryProfile.lastName}`);
        } else {
            console.log(`   ❌ No UserProfile with email secretary2023@swhoab.com`);
        }
        
        const secretaryVolunteer = volunteers.data.find(v => 
            v.email === 'secretary2023@swhoab.com'
        );
        
        if (secretaryVolunteer) {
            console.log(`   ✅ Found Volunteer with email secretary2023@swhoab.com`);
            console.log(`      userSub: ${secretaryVolunteer.userSub}`);
            console.log(`      displayName: ${secretaryVolunteer.displayName}`);
            console.log(`      id: ${secretaryVolunteer.id}`);
        } else {
            console.log(`   ❌ No Volunteer with email secretary2023@swhoab.com`);
        }
        
        console.log('\n🎯 SUMMARY:');
        console.log(`The user ID ${targetUserId} appears in interaction records as createdBy.`);
        console.log(`This is the Cognito sub (user ID) for secretary2023@swhoab.com.`);
        console.log('');
        
        if (!matchingProfile && !secretaryProfile) {
            console.log('PROBLEM: No UserProfile exists for this user.');
            console.log('SOLUTION: Need to create a UserProfile record with:');
            console.log(`  - sub: ${targetUserId}`);
            console.log('  - email: secretary2023@swhoab.com');
            console.log('  - firstName: Secretary');
            console.log('  - lastName: Simpson');
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

checkUserConnections();