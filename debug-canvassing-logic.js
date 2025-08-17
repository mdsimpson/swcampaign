import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function debugCanvassingLogic() {
    console.log('🔍 DEBUGGING CANVASSING MAP LOGIC\n');
    
    try {
        // Simulate the exact logic from CanvassingMap.tsx loadAssignments function
        
        // Step 1: Load ALL people first (same as Organize page)
        console.log('Step 1: Loading all residents...');
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
        
        // Step 2: Get all volunteers to find the current user's volunteer record
        const volunteersResult = await client.models.Volunteer.list();
        console.log('👥 All volunteers:', volunteersResult.data?.length || 0);
        
        // Find the volunteer record for secretary
        const currentUserVolunteer = volunteersResult.data.find(v => 
            v.email === 'secretary2023@swhoab.com'
        );
        console.log('👤 Secretary volunteer record:', currentUserVolunteer?.displayName || 'Not found');
        
        if (!currentUserVolunteer) {
            console.log('❌ No volunteer record found');
            return;
        }
        
        // Step 3: Get assignments for this volunteer
        const assignmentsResult = await client.models.Assignment.list({
            filter: { volunteerId: { eq: currentUserVolunteer.id } }
        });
        console.log(`📋 Found ${assignmentsResult.data?.length || 0} total assignments`);
        
        const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED');
        console.log(`📋 Active assignments: ${activeAssignments.length}`);
        
        // Step 4: Load homes for assignments (same pattern as Organize page)
        if (activeAssignments.length > 0) {
            const homeIds = activeAssignments.map(a => a.homeId);
            console.log(`🏠 Loading homes for ${homeIds.length} assignments...`);
            
            const homesWithDetailsPromises = homeIds.map(async (homeId) => {
                try {
                    const homeResult = await client.models.Home.get({ id: homeId });
                    if (homeResult.data) {
                        const home = homeResult.data;
                        
                        // Get residents for this home from pre-loaded list (Organize page approach)
                        const allResidentsForHome = allPeople.filter(p => p.homeId === homeId);
                        
                        // Filter out test/fake residents (enhanced version)
                        const realResidents = allResidentsForHome.filter(person => {
                            const fullName = `${person.firstName || ''} ${person.lastName || ''}`.toLowerCase();
                            const testPatterns = ['test', 'manual', 'debug', 'sample', 'fake', 'demo', 'resident'];
                            const specificFakes = ['test resident', 'manual resident', 'manual test', 'joe smith (test)', 'jane doe', 'john doe', 'bob smith'];
                            
                            // Filter by patterns and specific fake names
                            const hasTestPattern = testPatterns.some(pattern => fullName.includes(pattern));
                            const isSpecificFake = specificFakes.some(fake => fullName.includes(fake));
                            
                            return !hasTestPattern && !isSpecificFake;
                        });
                        
                        // Remove duplicate residents (same name at same address) - copied from Organize page
                        const uniqueResidents = realResidents.filter((person, index, self) => {
                            return index === self.findIndex(p => 
                                p.firstName === person.firstName && 
                                p.lastName === person.lastName
                            );
                        });
                        
                        // Sort residents (PRIMARY_OWNER first) - same as Organize page
                        const residents = uniqueResidents.sort((a, b) => {
                            const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 };
                            const aOrder = roleOrder[a.role] || 5;
                            const bOrder = roleOrder[b.role] || 5;
                            return aOrder - bOrder;
                        });
                        
                        console.log(`🏠 ${home.street}: ${residents.length} residents, Coords: ${home.lat}, ${home.lng}`);
                        
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
            
            console.log(`\n✅ Successfully loaded ${validHomes.length} homes with resident data`);
            
            // Step 5: Apply display filtering (from displayHomes useMemo)
            console.log('\n🗺️ DISPLAY FILTERING:');
            
            // Filter homes that have assignments
            const homesWithAssignments = validHomes.filter(h => 
                activeAssignments.some(a => a.homeId === h.id)
            );
            
            console.log(`Homes with assignments: ${homesWithAssignments.length}`);
            
            // Remove duplicates by home ID to prevent multiple markers at same location
            const uniqueHomes = homesWithAssignments.filter((home, index, array) => 
                array.findIndex(h => h.id === home.id) === index
            );
            
            console.log(`Unique homes (should show on map): ${uniqueHomes.length}`);
            console.log('Duplicates removed:', homesWithAssignments.length - uniqueHomes.length);
            
            // Show what should be displayed
            console.log('\n📍 HOMES THAT SHOULD SHOW AS MARKERS:');
            uniqueHomes.forEach((home, index) => {
                const hasCoords = home.lat && home.lng;
                console.log(`${index + 1}. ${hasCoords ? '✅' : '❌'} ${home.street} - Residents: ${home.residents.length} - Coords: ${home.lat}, ${home.lng}`);
            });
            
            // Count homes with coordinates
            const homesWithCoords = uniqueHomes.filter(h => h.lat && h.lng);
            console.log(`\n📊 FINAL COUNTS:`);
            console.log(`• Total unique homes: ${uniqueHomes.length}`);
            console.log(`• With coordinates (will show): ${homesWithCoords.length}`);
            console.log(`• Without coordinates (won't show): ${uniqueHomes.length - homesWithCoords.length}`);
            
        } else {
            console.log('❌ No active assignments found');
        }
        
    } catch (error) {
        console.error('💥 Failed to load assignments:', error);
    }
}

debugCanvassingLogic();