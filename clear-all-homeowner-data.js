import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function clearAllHomeownerData() {
    console.log('🧹 CLEARING ALL HOMEOWNER DATA FROM DATABASE\n');
    
    try {
        // Step 1: Clear all assignments
        console.log('1. 📋 Clearing all assignments...');
        const assignments = await client.models.Assignment.list({ limit: 10000 });
        console.log(`Found ${assignments.data?.length || 0} assignments to delete`);
        
        for (const assignment of assignments.data) {
            try {
                await client.models.Assignment.delete({ id: assignment.id });
                console.log(`  ✅ Deleted assignment ${assignment.id}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete assignment ${assignment.id}: ${error.message}`);
            }
        }
        
        // Step 2: Clear all people/residents
        console.log('\n2. 👥 Clearing all residents...');
        const people = await client.models.Person.list({ limit: 10000 });
        console.log(`Found ${people.data?.length || 0} residents to delete`);
        
        for (const person of people.data) {
            try {
                await client.models.Person.delete({ id: person.id });
                console.log(`  ✅ Deleted ${person.firstName} ${person.lastName}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete ${person.firstName} ${person.lastName}: ${error.message}`);
            }
        }
        
        // Step 3: Clear all homes
        console.log('\n3. 🏠 Clearing all homes...');
        const homes = await client.models.Home.list({ limit: 10000 });
        console.log(`Found ${homes.data?.length || 0} homes to delete`);
        
        for (const home of homes.data) {
            try {
                await client.models.Home.delete({ id: home.id });
                console.log(`  ✅ Deleted ${home.street}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete ${home.street}: ${error.message}`);
            }
        }
        
        // Step 4: Clear all consents
        console.log('\n4. ✍️ Clearing all consent records...');
        const consents = await client.models.Consent.list({ limit: 10000 });
        console.log(`Found ${consents.data?.length || 0} consent records to delete`);
        
        for (const consent of consents.data) {
            try {
                await client.models.Consent.delete({ id: consent.id });
                console.log(`  ✅ Deleted consent ${consent.id}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete consent ${consent.id}: ${error.message}`);
            }
        }
        
        // Step 5: Clear interaction records
        console.log('\n5. 📝 Clearing all interaction records...');
        const interactions = await client.models.InteractionRecord.list({ limit: 10000 });
        console.log(`Found ${interactions.data?.length || 0} interaction records to delete`);
        
        for (const interaction of interactions.data) {
            try {
                await client.models.InteractionRecord.delete({ id: interaction.id });
                console.log(`  ✅ Deleted interaction ${interaction.id}`);
            } catch (error) {
                console.log(`  ❌ Failed to delete interaction ${interaction.id}: ${error.message}`);
            }
        }
        
        console.log('\n6. ⏳ Waiting for database consistency...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verification
        console.log('\n7. ✅ VERIFICATION:');
        const finalHomes = await client.models.Home.list();
        const finalPeople = await client.models.Person.list();
        const finalAssignments = await client.models.Assignment.list();
        const finalConsents = await client.models.Consent.list();
        const finalInteractions = await client.models.InteractionRecord.list();
        
        console.log(`• Homes remaining: ${finalHomes.data?.length || 0}`);
        console.log(`• People remaining: ${finalPeople.data?.length || 0}`);
        console.log(`• Assignments remaining: ${finalAssignments.data?.length || 0}`);
        console.log(`• Consents remaining: ${finalConsents.data?.length || 0}`);
        console.log(`• Interactions remaining: ${finalInteractions.data?.length || 0}`);
        
        console.log('\n🎉 DATABASE CLEARED! Ready for fresh import from Homeowners2.csv');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

clearAllHomeownerData();