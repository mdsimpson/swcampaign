import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function finalDuplicateCleanup() {
    console.log('🧹 Final duplicate cleanup for working canvassing page...\n');
    
    try {
        // Target home IDs that work
        const workingHomes = {
            '42919 Cloverleaf Ct': '55d9b2b3-a92b-40c3-bd86-c08e0ae42070',
            '42927 Cloverleaf Ct': '362d06fc-7b70-434b-81a7-fb3bde43dd7f', 
            '42931 Cloverleaf Ct': 'ea62cdc5-d680-4fde-88b7-a8825316fc0a',
            '42942 Cloverleaf Ct': 'f71db520-a55b-487f-95da-c8c8db31e00a'
        };
        
        console.log('1. 🎯 Cleaning up duplicate residents...');
        
        // For each working home, keep only the right residents
        for (const [address, homeId] of Object.entries(workingHomes)) {
            console.log(`\n${address} (${homeId}):`);
            
            // Get all residents for this home
            const allPeople = await client.models.Person.list({ limit: 10000 });
            const residents = allPeople.data.filter(p => p.homeId === homeId);
            
            console.log(`  Current residents: ${residents.length}`);
            residents.forEach(r => {
                console.log(`    - ${r.firstName} ${r.lastName} (${r.role}) ID: ${r.id}`);
            });
            
            // Define what we want for each home
            let targetResidents = [];
            
            switch (address) {
                case '42919 Cloverleaf Ct':
                    targetResidents = [
                        { firstName: 'John', lastName: 'Doe', role: 'PRIMARY_OWNER' },
                        { firstName: 'Jane', lastName: 'Doe', role: 'SECONDARY_OWNER' }
                    ];
                    break;
                case '42927 Cloverleaf Ct':
                    targetResidents = [
                        { firstName: 'Michael', lastName: 'Simpson', role: 'PRIMARY_OWNER' },
                        { firstName: 'Oya', lastName: 'Simpson', role: 'SECONDARY_OWNER' }
                    ];
                    break;
                case '42931 Cloverleaf Ct':
                    targetResidents = [
                        { firstName: 'Luther', lastName: 'Williams', role: 'PRIMARY_OWNER' },
                        { firstName: 'Rebecca', lastName: 'Williams', role: 'SECONDARY_OWNER' }
                    ];
                    break;
                case '42942 Cloverleaf Ct':
                    targetResidents = [
                        { firstName: 'Bob', lastName: 'Smith', role: 'PRIMARY_OWNER' },
                        { firstName: 'Alice', lastName: 'Smith', role: 'SECONDARY_OWNER' }
                    ];
                    break;
            }
            
            // Group existing residents by name+role
            const existingByKey = {};
            residents.forEach(r => {
                const key = `${r.firstName}_${r.lastName}_${r.role}`;
                if (!existingByKey[key]) {
                    existingByKey[key] = [];
                }
                existingByKey[key].push(r);
            });
            
            // For each target resident
            for (const target of targetResidents) {
                const key = `${target.firstName}_${target.lastName}_${target.role}`;
                const existing = existingByKey[key] || [];
                
                console.log(`  Target: ${target.firstName} ${target.lastName} (${target.role})`);
                console.log(`    Existing: ${existing.length} found`);
                
                if (existing.length === 0) {
                    // Create missing resident
                    try {
                        await client.models.Person.create({
                            homeId: homeId,
                            firstName: target.firstName,
                            lastName: target.lastName,
                            role: target.role,
                            hasSigned: false
                        });
                        console.log(`    ✅ Created ${target.firstName} ${target.lastName}`);
                    } catch (error) {
                        console.log(`    ❌ Failed to create: ${error.message}`);
                    }
                } else if (existing.length === 1) {
                    // Perfect, keep this one
                    console.log(`    ✅ Keeping existing resident`);
                } else {
                    // Multiple duplicates, keep first and delete rest
                    console.log(`    🧹 Removing ${existing.length - 1} duplicates`);
                    for (let i = 1; i < existing.length; i++) {
                        try {
                            await client.models.Person.delete({ id: existing[i].id });
                            console.log(`    🗑️ Deleted duplicate ${existing[i].firstName} ${existing[i].lastName}`);
                        } catch (error) {
                            console.log(`    ❌ Failed to delete duplicate: ${error.message}`);
                        }
                    }
                }
            }
            
            // Delete any residents that don't match our targets
            const targetKeys = targetResidents.map(t => `${t.firstName}_${t.lastName}_${t.role}`);
            for (const [key, residentList] of Object.entries(existingByKey)) {
                if (!targetKeys.includes(key)) {
                    console.log(`  🗑️ Removing unwanted residents with key: ${key}`);
                    for (const resident of residentList) {
                        try {
                            await client.models.Person.delete({ id: resident.id });
                            console.log(`    🗑️ Deleted ${resident.firstName} ${resident.lastName}`);
                        } catch (error) {
                            console.log(`    ❌ Failed to delete: ${error.message}`);
                        }
                    }
                }
            }
        }
        
        // 2. Remove residents from old/wrong home IDs
        console.log('\n2. 🧹 Removing residents from old home IDs...');
        
        const oldHomeIds = [
            '8b303005-0eae-4421-9aab-47517e209e68',
            'cd8c33e8-5d6e-4c9f-9e16-9fd2a312ca4a',
            '0768de9c-1e30-4dcc-938d-223bdfdc4571',
            'b54f3380-85c8-42b2-84fc-01d155d1ac52',
            '4c1984d9-1f20-423a-ba17-ef9120070a40',
            '4a314731-5709-45c4-8f04-96e9f8d81426',
            '2c014418-28d9-4ea4-bd39-1eb14fa7f2d8',
            '0d112ee2-7913-46ff-8b22-ec655a7ffb20'
        ];
        
        const allPeople = await client.models.Person.list({ limit: 10000 });
        const oldResidents = allPeople.data.filter(p => 
            oldHomeIds.includes(p.homeId) && 
            (p.lastName === 'Simpson' || p.lastName === 'Williams' || p.lastName === 'Doe' || p.lastName === 'Smith')
        );
        
        console.log(`Found ${oldResidents.length} residents in old home IDs to remove:`);
        
        for (const resident of oldResidents) {
            try {
                await client.models.Person.delete({ id: resident.id });
                console.log(`  🗑️ Deleted ${resident.firstName} ${resident.lastName} from old home ${resident.homeId}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete ${resident.firstName} ${resident.lastName}: ${error.message}`);
            }
        }
        
        // 3. Final verification
        console.log('\n3. ✅ FINAL VERIFICATION:');
        console.log('═══════════════════════════════════════════════════\n');
        
        const finalPeople = await client.models.Person.list({ limit: 10000 });
        
        for (const [address, homeId] of Object.entries(workingHomes)) {
            const finalResidents = finalPeople.data
                .filter(p => p.homeId === homeId)
                .sort((a, b) => {
                    if (a.role === 'PRIMARY_OWNER') return -1;
                    if (b.role === 'PRIMARY_OWNER') return 1;
                    return 0;
                });
            
            console.log(`${address}:`);
            console.log(`  Residents: ${finalResidents.length}`);
            finalResidents.forEach(r => {
                console.log(`    - ${r.firstName} ${r.lastName} (${r.role})`);
            });
        }
        
        console.log('\n🎉 CLEANUP COMPLETE!');
        console.log('The canvassing page should now show clean data with:');
        console.log('  - No duplicate residents');
        console.log('  - Correct names for each address');
        console.log('  - Michael & Oya Simpson at 42927');
        console.log('  - Luther & Rebecca Williams at 42931');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

finalDuplicateCleanup();