import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });

async function testInteractionCreate() {
    console.log('🧪 TESTING INTERACTION RECORD CREATION\n');
    
    try {
        // Test with API Key auth (like the history page uses)
        console.log('1. Testing with API Key authentication...');
        const apiKeyClient = generateClient({ authMode: 'apiKey' });
        
        // First, get an address to test with
        const addressesResult = await apiKeyClient.models.Address.list({ limit: 10 });
        console.log(`   ✅ Found ${addressesResult.data.length} addresses`);
        
        if (addressesResult.data.length === 0) {
            console.log('   ❌ No addresses found to test with');
            return;
        }
        
        const testAddress = addressesResult.data.find(a => 
            a.street?.toLowerCase().includes('42927 cloverleaf')
        ) || addressesResult.data[0];
        
        console.log(`   Using test address: ${testAddress.street}, ${testAddress.city} (ID: ${testAddress.id})`);
        
        // Try to create a test interaction record
        console.log('\n2. Attempting to create test interaction record with API Key...');
        
        const testInteractionData = {
            addressId: testAddress.id,
            participantResidentIds: 'test-participant',
            spokeToHomeowner: true,
            spokeToOther: false,
            leftFlyer: true,
            notes: 'Test interaction from debug script',
            createdAt: new Date().toISOString(),
            createdBy: 'debug-script'
        };
        
        try {
            const result = await apiKeyClient.models.InteractionRecord.create(testInteractionData);
            console.log('   ✅ SUCCESS: Interaction record created with API Key');
            console.log('   Result ID:', result.data?.id);
            
            // Clean up - delete the test record
            if (result.data?.id) {
                await apiKeyClient.models.InteractionRecord.delete({ id: result.data.id });
                console.log('   🧹 Test record cleaned up');
            }
            
        } catch (apiError) {
            console.log('   ❌ FAILED with API Key:', apiError.message);
            console.log('   Full error:', apiError);
            
            // Try with user pool auth (like the form uses)
            console.log('\n3. Testing with User Pool authentication...');
            
            try {
                const userPoolClient = generateClient({ authMode: 'userPool' });
                const userResult = await userPoolClient.models.InteractionRecord.create(testInteractionData);
                console.log('   ✅ SUCCESS: Interaction record created with User Pool');
                console.log('   Result ID:', userResult.data?.id);
                
                // Clean up
                if (userResult.data?.id) {
                    await userPoolClient.models.InteractionRecord.delete({ id: userResult.data.id });
                    console.log('   🧹 Test record cleaned up');
                }
                
            } catch (userError) {
                console.log('   ❌ FAILED with User Pool:', userError.message);
                console.log('   Full error:', userError);
                
                console.log('\n🔍 DIAGNOSIS:');
                console.log('   The InteractionRecord model requires authentication and proper authorization.');
                console.log('   The user must be logged in and have Administrator, Organizer, or Canvasser role.');
                console.log('   Check the user\'s authentication status and role assignments.');
            }
        }
        
        console.log('\n4. Checking authorization rules...');
        console.log('   InteractionRecord authorization from schema:');
        console.log('   - allow.groups([\'Administrator\',\'Organizer\',\'Canvasser\']).to([\'create\',\'read\',\'update\'])');
        console.log('   - NO public API key access for create operations');
        console.log('\n   This means:');
        console.log('   - User must be authenticated (logged in)');
        console.log('   - User must have Administrator, Organizer, or Canvasser role');
        console.log('   - API Key auth will NOT work for creating interactions');
        
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

testInteractionCreate();