import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function debugFinalIssues() {
    console.log('🔍 Debugging final canvassing issues...');
    
    try {
        // 1. Check assignments for secretary2023@swhoab.com
        console.log('\n1. 📋 Checking secretary2023@swhoab.com assignments...');
        
        // Find the volunteer record
        const volunteersResult = await client.models.Volunteer.list();
        const secretary = volunteersResult.data.find(v => 
            v.email === 'secretary2023@swhoab.com' || 
            v.displayName?.includes('secretary')
        );
        
        if (!secretary) {
            console.log('❌ Secretary volunteer not found!');
            return;
        }
        
        console.log(`✅ Found secretary volunteer: ${secretary.displayName} (${secretary.email})`);
        console.log(`   ID: ${secretary.id}`);
        
        // Get assignments for this volunteer
        const assignmentsResult = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretary.id } }
        });
        
        console.log(`📋 Secretary has ${assignmentsResult.data?.length || 0} assignments:`);
        
        const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED');
        console.log(`   Active: ${activeAssignments.length}`);
        
        // 2. Check specific Cloverleaf addresses
        const cloverleafAddresses = [
            '42919 Cloverleaf Ct',
            '42927 Cloverleaf Ct', 
            '42931 Cloverleaf Ct',
            '42942 Cloverleaf Ct'
        ];
        
        console.log('\n2. 🏠 Checking specific Cloverleaf addresses...');
        
        for (const address of cloverleafAddresses) {
            console.log(`\n🔍 Checking: ${address}`);
            
            // Find homes with this address
            const homeQuery = await client.models.Home.list({
                filter: { street: { contains: address } }
            });
            
            console.log(`   Homes found: ${homeQuery.data?.length || 0}`);
            
            if (homeQuery.data?.length > 0) {
                for (const home of homeQuery.data) {
                    console.log(`   📍 Home ID: ${home.id}`);
                    console.log(`   📍 Full address: ${home.street}, ${home.city}, ${home.state}`);
                    console.log(`   📍 Coordinates: ${home.lat}, ${home.lng}`);
                    
                    // Check if this home is assigned to secretary
                    const isAssigned = activeAssignments.some(a => a.homeId === home.id);
                    console.log(`   📋 Assigned to secretary: ${isAssigned ? 'YES' : 'NO'}`);
                    
                    // Get residents for this home
                    const residentsResult = await client.models.Person.list({
                        filter: { homeId: { eq: home.id } }
                    });
                    
                    console.log(`   👥 Residents: ${residentsResult.data?.length || 0}`);
                    if (residentsResult.data?.length > 0) {
                        residentsResult.data.forEach(resident => {
                            console.log(`      ${resident.firstName} ${resident.lastName} (${resident.role})`);
                        });
                    }
                    
                    // Get all assignments for this home (not just secretary's)
                    const homeAssignments = await client.models.Assignment.list({
                        filter: { homeId: { eq: home.id } }
                    });
                    console.log(`   📋 Total assignments for this home: ${homeAssignments.data?.length || 0}`);
                    if (homeAssignments.data?.length > 0) {
                        for (const assignment of homeAssignments.data) {
                            const volunteer = volunteersResult.data.find(v => v.id === assignment.volunteerId);
                            console.log(`      Assigned to: ${volunteer?.displayName || 'Unknown'} (Status: ${assignment.status})`);
                        }
                    }
                }
            } else {
                console.log(`   ❌ No home found for ${address}`);
                
                // Search for similar addresses
                const partialAddress = address.split(' ')[0]; // Just the number
                const similarHomes = await client.models.Home.list({
                    filter: { street: { contains: partialAddress } }
                });
                
                console.log(`   🔍 Similar addresses found: ${similarHomes.data?.length || 0}`);
                if (similarHomes.data?.length > 0) {
                    similarHomes.data.forEach(home => {
                        console.log(`      ${home.street} (ID: ${home.id})`);
                    });
                }
            }
        }
        
        // 3. Check specific residents mentioned by user
        console.log('\n3. 👥 Checking specific residents...');
        
        const residents = [
            { firstName: 'Michael', lastName: 'Simpson' },
            { firstName: 'Oya', lastName: 'Simpson' },
            { firstName: 'Luther', lastName: 'Williams' },
            { firstName: 'Rebecca', lastName: 'Williams' }
        ];
        
        for (const resident of residents) {
            console.log(`\n🔍 Checking: ${resident.firstName} ${resident.lastName}`);
            
            const personQuery = await client.models.Person.list({
                filter: { 
                    firstName: { eq: resident.firstName },
                    lastName: { eq: resident.lastName }
                }
            });
            
            console.log(`   Found: ${personQuery.data?.length || 0} records`);
            
            if (personQuery.data?.length > 0) {
                for (const person of personQuery.data) {
                    console.log(`   👤 Person ID: ${person.id}`);
                    console.log(`   🏠 Home ID: ${person.homeId}`);
                    console.log(`   👑 Role: ${person.role}`);
                    
                    // Get the home for this person
                    if (person.homeId) {
                        const homeResult = await client.models.Home.get({ id: person.homeId });
                        if (homeResult.data) {
                            console.log(`   📍 Lives at: ${homeResult.data.street}`);
                            console.log(`   📍 Coordinates: ${homeResult.data.lat}, ${homeResult.data.lng}`);
                        }
                    }
                }
            } else {
                console.log(`   ❌ No records found for ${resident.firstName} ${resident.lastName}`);
            }
        }
        
        // 4. Summary
        console.log('\n4. 📊 SUMMARY');
        console.log('='.repeat(50));
        console.log(`Secretary assignments: ${activeAssignments.length}`);
        console.log('Assignment details:');
        
        for (const assignment of activeAssignments) {
            const homeResult = await client.models.Home.get({ id: assignment.homeId });
            if (homeResult.data) {
                console.log(`  📍 ${homeResult.data.street} (${homeResult.data.lat ? 'HAS' : 'NO'} coords)`);
            }
        }
        
        console.log('\n✅ Debug complete!');
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

debugFinalIssues();