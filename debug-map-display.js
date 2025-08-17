import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function debugMapDisplay() {
    console.log('🗺️ DEBUGGING WHY MAP SHOWS ONLY 13 MARKERS INSTEAD OF 17\n');
    
    try {
        // Simulate the exact canvassing map logic
        
        // Step 1: Load ALL people
        console.log('1. Loading all residents...');
        let allPeople = [];
        let peopleNextToken = null;
        
        do {
            const peopleResult = await client.models.Person.list({ 
                limit: 1000,
                nextToken: peopleNextToken
            });
            allPeople.push(...peopleResult.data);
            peopleNextToken = peopleResult.nextToken;
        } while (peopleNextToken);
        
        console.log(`✅ Loaded ${allPeople.length} total residents`);
        
        // Step 2: Get Secretary Simpson volunteer
        const volunteersResult = await client.models.Volunteer.list();
        const currentUserVolunteer = volunteersResult.data.find(v => 
            v.email === 'secretary2023@swhoab.com'
        );
        
        console.log(`\n2. Found volunteer: ${currentUserVolunteer?.displayName || 'Not found'}`);
        
        if (!currentUserVolunteer) {
            console.log('❌ No volunteer record found');
            return;
        }
        
        // Step 3: Get assignments
        const assignmentsResult = await client.models.Assignment.list({
            filter: { volunteerId: { eq: currentUserVolunteer.id } }
        });
        
        const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED');
        console.log(`\n3. Active assignments: ${activeAssignments.length}`);
        
        // Step 4: Load homes and apply exact canvassing logic
        if (activeAssignments.length > 0) {
            const homeIds = activeAssignments.map(a => a.homeId);
            console.log(`\n4. Loading ${homeIds.length} homes...`);
            
            const validHomes = [];
            
            for (const homeId of homeIds) {
                try {
                    const homeResult = await client.models.Home.get({ id: homeId });
                    if (homeResult.data) {
                        const home = homeResult.data;
                        
                        // Apply resident filtering
                        const allResidentsForHome = allPeople.filter(p => p.homeId === homeId);
                        
                        const realResidents = allResidentsForHome.filter(person => {
                            const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
                            const testPatterns = ['test', 'manual', 'debug', 'sample', 'fake', 'demo', 'resident'];
                            const specificFakes = ['test resident', 'manual resident', 'manual test', 'joe smith (test)', 'jane doe', 'john doe', 'bob smith'];
                            
                            const hasTestPattern = testPatterns.some(pattern => fullName.includes(pattern));
                            const isSpecificFake = specificFakes.some(fake => fullName.includes(fake));
                            
                            return !hasTestPattern && !isSpecificFake;
                        });
                        
                        validHomes.push({
                            ...home,
                            residents: realResidents
                        });
                    }
                } catch (error) {
                    console.log(`❌ Failed to load home ${homeId}: ${error.message}`);
                }
            }
            
            console.log(`✅ Loaded ${validHomes.length} valid homes`);
            
            // Step 5: Apply display filtering (simulate displayHomes useMemo)
            console.log('\n5. Applying canvassing map display logic...');
            
            // Filter homes with assignments
            const homesWithAssignments = validHomes.filter(h => 
                activeAssignments.some(a => a.homeId === h.id)
            );
            
            console.log(`Homes with assignments: ${homesWithAssignments.length}`);
            
            // Remove duplicates by home ID (this is key!)
            const uniqueHomes = homesWithAssignments.filter((home, index, array) => 
                array.findIndex(h => h.id === home.id) === index
            );
            
            console.log(`Unique homes after deduplication: ${uniqueHomes.length}`);
            console.log(`Duplicates removed: ${homesWithAssignments.length - uniqueHomes.length}`);
            
            // Check coordinates
            const homesForMap = uniqueHomes.filter(h => h.lat && h.lng);
            
            console.log('\n📊 FINAL RESULTS:');
            console.log(`• Total assignments: ${activeAssignments.length}`);
            console.log(`• Homes loaded: ${validHomes.length}`);
            console.log(`• Unique homes: ${uniqueHomes.length}`);
            console.log(`• Homes with coordinates (markers on map): ${homesForMap.length}`);
            
            console.log('\n📍 MARKERS THAT SHOULD APPEAR ON MAP:');
            homesForMap.forEach((home, index) => {
                console.log(`${index + 1}. ${home.street} (${home.residents.length} residents)`);
                console.log(`   Coords: ${home.lat}, ${home.lng}`);
                console.log(`   Home ID: ${home.id}`);
                console.log('');
            });
            
            console.log('🎯 CONCLUSION:');
            if (homesForMap.length === 13) {
                console.log('✅ Logic matches what you see (13 markers)');
                console.log('This means some assignments are not loading correctly');
            } else if (homesForMap.length === 17) {
                console.log('❌ Logic shows 17 but you see 13');
                console.log('This suggests a browser/caching issue or map rendering problem');
            } else {
                console.log(`❓ Logic shows ${homesForMap.length} markers`);
                console.log('This is unexpected - investigating further needed');
            }
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

debugMapDisplay();