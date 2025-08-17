import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });

async function checkUserAuth() {
    console.log('👤 CHECKING USER AUTHENTICATION AND AUTHORIZATION\n');
    
    try {
        // Check what we can access with different auth modes
        console.log('1. Testing API Key access to InteractionRecord...');
        const apiClient = generateClient({ authMode: 'apiKey' });
        
        try {
            const apiResult = await apiClient.models.InteractionRecord.list({ limit: 1 });
            console.log('   ✅ API Key can read InteractionRecord');
            console.log(`   Found ${apiResult.data.length} records`);
        } catch (apiError) {
            console.log('   ❌ API Key cannot access InteractionRecord:', apiError.message);
        }
        
        console.log('\n2. Testing User Pool access to InteractionRecord...');
        const userClient = generateClient({ authMode: 'userPool' });
        
        try {
            const userResult = await userClient.models.InteractionRecord.list({ limit: 1 });
            console.log('   ✅ User Pool can read InteractionRecord');
            console.log(`   Found ${userResult.data.length} records`);
        } catch (userError) {
            console.log('   ❌ User Pool cannot access InteractionRecord:', userError.message);
            console.log('   This suggests the user is not authenticated or lacks proper role');
        }
        
        console.log('\n3. Checking UserProfile records to see what users exist...');
        try {
            const profilesResult = await apiClient.models.UserProfile.list({ limit: 10 });
            console.log(`   ✅ Found ${profilesResult.data.length} user profiles:`);
            profilesResult.data.forEach(profile => {
                console.log(`   - ${profile.email || 'No email'} (${profile.firstName} ${profile.lastName}) - Role: ${profile.roleCache || 'No role'}`);
            });
        } catch (profileError) {
            console.log('   ❌ Cannot access UserProfile:', profileError.message);
        }
        
        console.log('\n4. Checking if we can create other records with userPool auth...');
        
        // Try to read Address records with userPool auth
        try {
            const addressResult = await userClient.models.Address.list({ limit: 1 });
            console.log('   ✅ User Pool can read Address records');
        } catch (addrError) {
            console.log('   ❌ User Pool cannot read Address records:', addrError.message);
        }
        
        console.log('\n🔍 DIAGNOSIS:');
        console.log('If User Pool auth fails, it means:');
        console.log('1. User is not logged in to the frontend');
        console.log('2. User session has expired');
        console.log('3. User lacks the required role (Administrator, Organizer, or Canvasser)');
        console.log('\nTo fix this:');
        console.log('- Make sure you are logged in at localhost:5173');
        console.log('- Check that secretary2023@swhoab.com has the Canvasser role');
        console.log('- Try logging out and logging back in');
        
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

checkUserAuth();