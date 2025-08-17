import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function fixHomeIds() {
    console.log('🔧 Fixing resident home ID mismatches...\n');
    
    try {
        // Define the correct home IDs based on the verification
        const correctHomeIds = {
            '42927 Cloverleaf Ct': '362d06fc-7b70-434b-81a7-fb3bde43dd7f',
            '42931 Cloverleaf Ct': 'ea62cdc5-d680-4fde-88b7-a8825316fc0a',
            '42942 Cloverleaf Ct': 'f71db520-a55b-487f-95da-c8c8db31e00a',
            '42919 Cloverleaf Ct': 'f8844237-ab44-4c35-a68a-f80d7ea107c4'
        };
        
        // 1. Fix Michael Simpson
        console.log('1. 🔧 Fixing Michael Simpson...');
        const michaelQuery = await client.models.Person.list({
            filter: {
                firstName: { eq: 'Michael' },
                lastName: { eq: 'Simpson' }
            }
        });
        
        for (const michael of michaelQuery.data) {
            if (michael.homeId !== correctHomeIds['42927 Cloverleaf Ct']) {
                try {
                    await client.models.Person.update({
                        id: michael.id,
                        homeId: correctHomeIds['42927 Cloverleaf Ct']
                    });
                    console.log(`   ✅ Moved Michael Simpson to correct home`);
                } catch (error) {
                    console.log(`   ❌ Failed to move Michael Simpson:`, error.message);
                }
            } else {
                console.log(`   ✅ Michael Simpson already at correct home`);
            }
        }
        
        // 2. Fix Luther Williams (consolidate duplicates)
        console.log('\n2. 🔧 Fixing Luther Williams...');
        const lutherQuery = await client.models.Person.list({
            filter: {
                firstName: { eq: 'Luther' },
                lastName: { eq: 'Williams' }
            }
        });
        
        console.log(`   Found ${lutherQuery.data.length} Luther Williams records`);
        
        // Keep the first one, move to correct home if needed, delete duplicates
        if (lutherQuery.data.length > 0) {
            const firstLuther = lutherQuery.data[0];
            
            // Move to correct home if needed
            if (firstLuther.homeId !== correctHomeIds['42931 Cloverleaf Ct']) {
                try {
                    await client.models.Person.update({
                        id: firstLuther.id,
                        homeId: correctHomeIds['42931 Cloverleaf Ct']
                    });
                    console.log(`   ✅ Moved Luther Williams to correct home`);
                } catch (error) {
                    console.log(`   ❌ Failed to move Luther Williams:`, error.message);
                }
            }
            
            // Delete duplicates
            for (let i = 1; i < lutherQuery.data.length; i++) {
                try {
                    await client.models.Person.delete({ id: lutherQuery.data[i].id });
                    console.log(`   ✅ Deleted duplicate Luther Williams`);
                } catch (error) {
                    console.log(`   ❌ Failed to delete duplicate:`, error.message);
                }
            }
        }
        
        // 3. Check if Rebecca Williams is at correct home
        console.log('\n3. 🔧 Checking Rebecca Williams...');
        const rebeccaQuery = await client.models.Person.list({
            filter: {
                firstName: { eq: 'Rebecca' },
                lastName: { eq: 'Williams' }
            }
        });
        
        for (const rebecca of rebeccaQuery.data) {
            if (rebecca.homeId === correctHomeIds['42931 Cloverleaf Ct']) {
                console.log(`   ✅ Rebecca Williams already at correct home`);
            } else {
                console.log(`   ⚠️ Rebecca Williams at wrong home (${rebecca.homeId}), not moving to avoid conflicts`);
            }
        }
        
        // 4. Create missing residents
        console.log('\n4. 🆕 Creating missing residents...');
        
        // Check if Oya Simpson exists
        const oyaQuery = await client.models.Person.list({
            filter: {
                firstName: { eq: 'Oya' },
                lastName: { eq: 'Simpson' }
            }
        });
        
        if (oyaQuery.data.length === 0) {
            try {
                await client.models.Person.create({
                    homeId: correctHomeIds['42927 Cloverleaf Ct'],
                    firstName: 'Oya',
                    lastName: 'Simpson',
                    role: 'SECONDARY_OWNER',
                    hasSigned: false
                });
                console.log(`   ✅ Created Oya Simpson`);
            } catch (error) {
                console.log(`   ❌ Failed to create Oya Simpson:`, error.message);
            }
        } else {
            // Move Oya to correct home if needed
            const oya = oyaQuery.data[0];
            if (oya.homeId !== correctHomeIds['42927 Cloverleaf Ct']) {
                try {
                    await client.models.Person.update({
                        id: oya.id,
                        homeId: correctHomeIds['42927 Cloverleaf Ct']
                    });
                    console.log(`   ✅ Moved Oya Simpson to correct home`);
                } catch (error) {
                    console.log(`   ❌ Failed to move Oya Simpson:`, error.message);
                }
            } else {
                console.log(`   ✅ Oya Simpson already at correct home`);
            }
        }
        
        // 5. Wait and verify fixes
        console.log('\n5. ⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        
        console.log('\n6. ✅ VERIFICATION:');
        console.log('═══════════════════════════════════════════════════\n');
        
        for (const [address, homeId] of Object.entries(correctHomeIds)) {
            const residents = await client.models.Person.list({
                filter: { homeId: { eq: homeId } }
            });
            
            console.log(`${address} (${homeId}):`);
            console.log(`  Residents: ${residents.data?.length}`);
            residents.data?.forEach(r => {
                console.log(`    - ${r.firstName} ${r.lastName} (${r.role})`);
            });
        }
        
        console.log('\n🎉 Home ID fixes complete!');
        console.log('Now the canvassing page should show the correct residents.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

fixHomeIds();