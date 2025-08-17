import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function testCanvassingLogic() {
    console.log('🧪 Testing canvassing page logic...\n');
    
    try {
        // 1. Test volunteer lookup (this is what the canvassing page does)
        console.log('1. 🔍 Finding volunteers...');
        const volunteersResult = await client.models.Volunteer.list();
        console.log(`Found ${volunteersResult.data?.length} volunteers:`);
        
        volunteersResult.data?.forEach(v => {
            console.log(`  - ${v.displayName} (${v.email}) userSub: ${v.userSub}`);
        });
        
        if (volunteersResult.data?.length === 0) {
            console.log('❌ No volunteers found! The canvassing page won\'t work.');
            return;
        }
        
        const testVolunteer = volunteersResult.data[0];
        console.log(`\nUsing test volunteer: ${testVolunteer.displayName}`);
        
        // 2. Get assignments for this volunteer (mimicking canvassing page logic)
        console.log('\n2. 📋 Getting assignments...');
        const assignmentsResult = await client.models.Assignment.list({
            filter: { volunteerId: { eq: testVolunteer.id } }
        });
        
        console.log(`Found ${assignmentsResult.data?.length} assignments for this volunteer:`);
        
        const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED');
        console.log(`Active assignments: ${activeAssignments.length}`);
        
        if (activeAssignments.length === 0) {
            console.log('❌ No active assignments! The canvassing page won\'t show any homes.');
            return;
        }
        
        // 3. Load homes for assignments (mimicking canvassing page logic)
        console.log('\n3. 🏠 Loading homes for assignments...');
        
        // Load all residents first (like the canvassing page does)
        const allPeopleResult = await client.models.Person.list({ limit: 10000 });
        const allPeople = allPeopleResult.data || [];
        console.log(`Loaded ${allPeople.length} total residents`);
        
        const homeIds = activeAssignments.map(a => a.homeId);
        console.log(`Home IDs to load: ${homeIds.join(', ')}`);
        
        const assignedHomes = [];
        
        for (const homeId of homeIds) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId });
                if (homeResult.data) {
                    console.log(`\n   📍 Found home: ${homeResult.data.street}`);
                    
                    // Get residents for this home from the pre-loaded list (canvassing page logic)
                    const residents = allPeople
                        .filter(person => person.homeId === homeId)
                        .sort((a, b) => {
                            if (a.role === 'PRIMARY_OWNER') return -1
                            if (b.role === 'PRIMARY_OWNER') return 1
                            if (a.role === 'SECONDARY_OWNER') return -1
                            if (b.role === 'SECONDARY_OWNER') return 1
                            return 0
                        });
                    
                    console.log(`   👥 Residents found: ${residents.length}`);
                    if (residents.length > 0) {
                        residents.forEach(r => {
                            console.log(`     - ${r.firstName} ${r.lastName} (${r.role})`);
                        });
                    }
                    
                    assignedHomes.push({
                        ...homeResult.data,
                        residents: residents
                    });
                }
            } catch (error) {
                console.error(`   ❌ Failed to load home ${homeId}:`, error.message);
            }
        }
        
        // 4. Summary
        console.log('\n4. 📊 SUMMARY:');
        console.log('═══════════════════════════════════════════════════');
        console.log(`Total homes that would show on canvassing map: ${assignedHomes.length}`);
        
        assignedHomes.forEach(home => {
            const hasCoords = home.lat && home.lng;
            console.log(`\n${home.street}:`);
            console.log(`  📍 Coordinates: ${hasCoords ? 'YES' : 'NO'} (${home.lat}, ${home.lng})`);
            console.log(`  👥 Residents: ${home.residents.length}`);
            if (home.residents.length > 0) {
                home.residents.forEach(r => {
                    console.log(`    - ${r.firstName} ${r.lastName} (${r.role})`);
                });
            }
        });
        
        // 5. Issues summary
        console.log('\n5. 🚨 ISSUES FOUND:');
        console.log('═══════════════════════════════════════════════════');
        
        const homesWithoutCoords = assignedHomes.filter(h => !h.lat || !h.lng);
        const homesWithoutResidents = assignedHomes.filter(h => h.residents.length === 0);
        
        if (homesWithoutCoords.length > 0) {
            console.log(`❌ ${homesWithoutCoords.length} homes missing coordinates (won't show markers)`);
            homesWithoutCoords.forEach(h => console.log(`   - ${h.street}`));
        }
        
        if (homesWithoutResidents.length > 0) {
            console.log(`❌ ${homesWithoutResidents.length} homes missing residents (popups will be empty)`);
            homesWithoutResidents.forEach(h => console.log(`   - ${h.street}`));
        }
        
        if (homesWithoutCoords.length === 0 && homesWithoutResidents.length === 0) {
            console.log('✅ All homes have coordinates and residents! The canvassing page should work perfectly.');
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

testCanvassingLogic();