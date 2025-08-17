import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkInteractions() {
    console.log('🔍 CHECKING INTERACTION RECORDS IN DATABASE\n');
    
    try {
        // Step 1: Load all interaction records
        console.log('1. Loading all interaction records...');
        
        const interactionsResult = await client.models.InteractionRecord.list({ limit: 1000 });
        const allInteractions = interactionsResult.data;
        
        console.log(`   ✅ Found ${allInteractions.length} total interaction records`);
        
        if (allInteractions.length === 0) {
            console.log('   ❌ No interaction records found in database');
            return;
        }
        
        // Step 2: Load addresses to match with interactions
        console.log('\n2. Loading addresses for matching...');
        
        const addressesResult = await client.models.Address.list({ limit: 5000 });
        const allAddresses = addressesResult.data;
        
        console.log(`   📍 Found ${allAddresses.length} addresses`);
        
        // Step 3: Check for 42927 Cloverleaf Ct specifically
        console.log('\n3. Looking for 42927 Cloverleaf Ct interactions...');
        
        const cloverleafAddresses = allAddresses.filter(addr => 
            addr.street?.toLowerCase().includes('42927 cloverleaf')
        );
        
        console.log(`   Found ${cloverleafAddresses.length} address records for 42927 Cloverleaf Ct:`);
        cloverleafAddresses.forEach(addr => {
            console.log(`   - ID: ${addr.id}, Street: ${addr.street}, City: ${addr.city}`);
        });
        
        if (cloverleafAddresses.length === 0) {
            console.log('   ❌ No address records found for 42927 Cloverleaf Ct');
            return;
        }
        
        // Step 4: Find interactions at this address
        const cloverleafAddressIds = cloverleafAddresses.map(a => a.id);
        const cloverleafInteractions = allInteractions.filter(interaction => 
            cloverleafAddressIds.includes(interaction.addressId)
        );
        
        console.log(`\n   Found ${cloverleafInteractions.length} interactions at 42927 Cloverleaf Ct:`);
        
        if (cloverleafInteractions.length === 0) {
            console.log('   ❌ No interactions found for 42927 Cloverleaf Ct');
            console.log('   This means the interaction was NOT saved to the database');
        } else {
            cloverleafInteractions.forEach((interaction, index) => {
                console.log(`\n   Interaction ${index + 1}:`);
                console.log(`   - ID: ${interaction.id}`);
                console.log(`   - Address ID: ${interaction.addressId}`);
                console.log(`   - Created At: ${interaction.createdAt}`);
                console.log(`   - Created By: ${interaction.createdBy}`);
                console.log(`   - Spoke to Homeowner: ${interaction.spokeToHomeowner}`);
                console.log(`   - Spoke to Other: ${interaction.spokeToOther}`);
                console.log(`   - Left Flyer: ${interaction.leftFlyer}`);
                console.log(`   - Participants: ${interaction.participantResidentIds || 'None'}`);
                console.log(`   - Notes: ${interaction.notes || 'No notes'}`);
                if (interaction.lat && interaction.lng) {
                    console.log(`   - Location: ${interaction.lat}, ${interaction.lng}`);
                }
            });
        }
        
        // Step 5: Show all interactions for debugging
        console.log('\n4. All interaction records (for debugging):');
        
        allInteractions.forEach((interaction, index) => {
            const address = allAddresses.find(a => a.id === interaction.addressId);
            const addressDisplay = address ? `${address.street}, ${address.city}` : `Unknown (ID: ${interaction.addressId})`;
            
            console.log(`\n   Interaction ${index + 1}:`);
            console.log(`   - Address: ${addressDisplay}`);
            console.log(`   - Created: ${interaction.createdAt}`);
            console.log(`   - By: ${interaction.createdBy}`);
            console.log(`   - Type: ${[
                interaction.spokeToHomeowner ? 'Spoke to homeowner' : null,
                interaction.spokeToOther ? 'Spoke to other' : null,
                interaction.leftFlyer ? 'Left flyer' : null
            ].filter(Boolean).join(', ') || 'No interaction type recorded'}`);
        });
        
        console.log('\n🎉 DATABASE CHECK COMPLETE!');
        
    } catch (error) {
        console.error('💥 Error checking interactions:', error);
    }
}

checkInteractions();