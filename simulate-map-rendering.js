import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function simulateMapRendering() {
    console.log('🗺️ SIMULATING MAP RENDERING LOGIC\n');
    
    try {
        // Step 1: Replicate loadAssignments() logic exactly
        console.log('1. Loading residents...');
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
        
        console.log(`✅ Loaded ${allPeople.length} residents`);
        
        // Step 2: Get volunteer and assignments
        const volunteersResult = await client.models.Volunteer.list();
        const currentUserVolunteer = volunteersResult.data.find(v => 
            v.email === 'secretary2023@swhoab.com'
        );
        
        const assignmentsResult = await client.models.Assignment.list({
            filter: { volunteerId: { eq: currentUserVolunteer.id } }
        });
        
        const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED');
        console.log(`\n2. Active assignments: ${activeAssignments.length}`);
        
        // Step 3: Load homes (replicate exact logic)
        const homeIds = activeAssignments.map(a => a.homeId);
        const homesWithDetailsPromises = homeIds.map(async (homeId) => {
            try {
                const homeResult = await client.models.Home.get({ id: homeId });
                if (homeResult.data) {
                    const home = homeResult.data;
                    
                    // Get residents and filter
                    const allResidentsForHome = allPeople.filter(p => p.homeId === homeId);
                    
                    const realResidents = allResidentsForHome.filter(person => {
                        const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
                        const testPatterns = ['test', 'manual', 'debug', 'sample', 'fake', 'demo', 'resident'];
                        const specificFakes = ['test resident', 'manual resident', 'manual test', 'joe smith (test)', 'jane doe', 'john doe', 'bob smith'];
                        
                        const hasTestPattern = testPatterns.some(pattern => fullName.includes(pattern));
                        const isSpecificFake = specificFakes.some(fake => fullName.includes(fake));
                        
                        return !hasTestPattern && !isSpecificFake;
                    });
                    
                    // Remove duplicate residents
                    const uniqueResidents = realResidents.filter((person, index, self) => {
                        return index === self.findIndex(p => 
                            p.firstName === person.firstName && 
                            p.lastName === person.lastName
                        );
                    });
                    
                    // Sort residents
                    const residents = uniqueResidents.sort((a, b) => {
                        const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 };
                        const aOrder = roleOrder[a.role] || 5;
                        const bOrder = roleOrder[b.role] || 5;
                        return aOrder - bOrder;
                    });
                    
                    console.log(`🏠 ${home.street}: ${residents.length} unique residents`);
                    
                    return {
                        ...home,
                        residents: residents
                    };
                }
            } catch (error) {
                console.error(`❌ Failed to load home ${homeId}:`, error);
            }
            return null;
        });
        
        const allHomesWithDetails = await Promise.all(homesWithDetailsPromises);
        const validHomes = allHomesWithDetails.filter(home => home !== null);
        
        console.log(`\n3. Successfully loaded ${validHomes.length} homes with resident data`);
        
        // Step 4: Apply displayHomes useMemo logic
        const showAll = false; // Default state
        
        let filteredHomes = showAll ? validHomes : validHomes.filter(h => 
            activeAssignments.some(a => a.homeId === h.id)
        );
        
        // Remove duplicates by home ID
        const uniqueHomes = filteredHomes.filter((home, index, array) => 
            array.findIndex(h => h.id === home.id) === index
        );
        
        console.log('\n4. displayHomes stats:', {
            total: filteredHomes.length,
            unique: uniqueHomes.length,
            duplicatesRemoved: filteredHomes.length - uniqueHomes.length
        });
        
        // Step 5: Simulate map rendering
        console.log('\n5. 🎯 SIMULATING MAP MARKER RENDERING:');
        
        let renderedCount = 0;
        
        uniqueHomes.forEach(home => {
            const hasCoords = !!(home.lat && home.lng);
            console.log(`🎯 Rendering marker for: ${home.street}, lat: ${home.lat}, lng: ${home.lng}, hasCoords: ${hasCoords}`);
            
            if (hasCoords) {
                renderedCount++;
                console.log(`   ✅ MARKER ${renderedCount} RENDERED`);
            } else {
                console.log(`   ❌ MARKER SKIPPED (no coordinates)`);
            }
        });
        
        console.log(`\n📊 FINAL RENDERING RESULTS:`);
        console.log(`• Homes in displayHomes: ${uniqueHomes.length}`);
        console.log(`• Markers that should render: ${renderedCount}`);
        console.log(`• You see on map: 13`);
        
        if (renderedCount === 13) {
            console.log(`✅ Logic matches what you see (13 markers)`);
        } else {
            console.log(`❌ Logic shows ${renderedCount} but you see 13`);
            console.log(`This suggests a Google Maps rendering issue or browser problem`);
        }
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

simulateMapRendering();