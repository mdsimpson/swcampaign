import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function deleteAllRecords(modelName) {
    console.log(`\n🗑️ Clearing all ${modelName} records...`);
    let totalDeleted = 0;
    
    while (true) {
        const result = await client.models[modelName].list({ limit: 100 });
        
        if (!result.data || result.data.length === 0) {
            break;
        }
        
        console.log(`Found ${result.data.length} ${modelName} records to delete...`);
        
        // Delete in smaller batches to avoid timeouts
        for (const record of result.data) {
            try {
                await client.models[modelName].delete({ id: record.id });
                totalDeleted++;
                if (totalDeleted % 50 === 0) {
                    console.log(`  ✅ Deleted ${totalDeleted} ${modelName} records so far...`);
                }
            } catch (error) {
                console.log(`  ❌ Failed to delete ${modelName} ${record.id}: ${error.message}`);
            }
        }
    }
    
    console.log(`✅ Deleted ${totalDeleted} ${modelName} records total`);
    return totalDeleted;
}

async function completeDatabaseReset() {
    console.log('🧹 COMPLETE DATABASE RESET\n');
    
    try {
        // Clear all models in dependency order
        await deleteAllRecords('Assignment');
        await deleteAllRecords('InteractionRecord');
        await deleteAllRecords('Consent');
        await deleteAllRecords('Person');
        await deleteAllRecords('Home');
        
        console.log('\n⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Final verification
        console.log('\n✅ FINAL VERIFICATION:');
        const homes = await client.models.Home.list();
        const people = await client.models.Person.list();
        const assignments = await client.models.Assignment.list();
        const consents = await client.models.Consent.list();
        const interactions = await client.models.InteractionRecord.list();
        
        console.log(`• Homes: ${homes.data?.length || 0}`);
        console.log(`• People: ${people.data?.length || 0}`);
        console.log(`• Assignments: ${assignments.data?.length || 0}`);
        console.log(`• Consents: ${consents.data?.length || 0}`);
        console.log(`• Interactions: ${interactions.data?.length || 0}`);
        
        const total = (homes.data?.length || 0) + (people.data?.length || 0) + 
                     (assignments.data?.length || 0) + (consents.data?.length || 0) + 
                     (interactions.data?.length || 0);
        
        if (total === 0) {
            console.log('\n🎉 DATABASE COMPLETELY CLEARED! Ready for fresh import.');
        } else {
            console.log(`\n⚠️ ${total} records still remain. May need to run again.`);
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

completeDatabaseReset();