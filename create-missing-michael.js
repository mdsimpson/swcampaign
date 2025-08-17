import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function createMissingMichael() {
    console.log('🔧 Creating missing Michael Simpson and testing volunteer/assignments...');
    
    try {
        // 1. Create Michael Simpson
        console.log('\n1. 🆕 Creating Michael Simpson...');
        
        const michaelHomeId = '362d06fc-7b70-434b-81a7-fb3bde43dd7f'; // 42927 Cloverleaf Ct
        
        try {
            await client.models.Person.create({
                homeId: michaelHomeId,
                firstName: 'Michael',
                lastName: 'Simpson',
                role: 'PRIMARY_OWNER',
                hasSigned: false
            });
            console.log('✅ Created Michael Simpson');
        } catch (error) {
            console.error('❌ Failed to create Michael Simpson:', error.message);
        }
        
        // 2. Also update Rebecca Williams to be at Luther's home
        console.log('\n2. 🔧 Ensuring Rebecca Williams is at correct home...');
        
        const rebeccaQuery = await client.models.Person.list({
            filter: { 
                firstName: { eq: 'Rebecca' },
                lastName: { eq: 'Williams' }
            }
        });
        
        if (rebeccaQuery.data?.length > 0) {
            const rebecca = rebeccaQuery.data[0];
            const lutherHomeId = 'b54f3380-85c8-42b2-84fc-01d155d1ac52'; // 42931 Cloverleaf Ct
            
            if (rebecca.homeId !== lutherHomeId) {
                try {
                    await client.models.Person.update({
                        id: rebecca.id,
                        homeId: lutherHomeId
                    });
                    console.log('✅ Moved Rebecca Williams to Luther\'s home');
                } catch (error) {
                    console.error('❌ Failed to move Rebecca Williams:', error.message);
                }
            } else {
                console.log('✅ Rebecca Williams already at correct home');
            }
        }
        
        // 3. Create a test volunteer and assignments for testing
        console.log('\n3. 🧪 Creating test volunteer and assignments...');
        
        // Create a volunteer record for secretary2023@swhoab.com
        let volunteerToUse = null;
        
        try {
            volunteerToUse = await client.models.Volunteer.create({
                userSub: 'test-secretary-123', // This should match the user's auth sub
                displayName: 'Secretary Test User',
                email: 'secretary2023@swhoab.com'
            });
            console.log('✅ Created test volunteer');
        } catch (error) {
            console.log('Volunteer creation failed, checking if exists:', error.message);
            
            // Try to find existing volunteer
            const volunteerQuery = await client.models.Volunteer.list();
            if (volunteerQuery.data?.length > 0) {
                volunteerToUse = volunteerQuery.data[0];
                console.log(`Using existing volunteer: ${volunteerToUse.displayName}`);
            }
        }
        
        if (volunteerToUse) {
            // Create assignments for all 4 Cloverleaf homes
            const cloverleafHomeIds = [
                '362d06fc-7b70-434b-81a7-fb3bde43dd7f', // 42927 Cloverleaf Ct (Michael & Oya)
                'b54f3380-85c8-42b2-84fc-01d155d1ac52'  // 42931 Cloverleaf Ct (Luther & Rebecca)
            ];
            
            // Get the newly created homes
            const newHomes = await client.models.Home.list({
                filter: { street: { contains: 'Cloverleaf' } }
            });
            
            // Add the new homes to assignments
            for (const home of newHomes.data) {
                if (home.street.includes('42919') || home.street.includes('42942')) {
                    cloverleafHomeIds.push(home.id);
                }
            }
            
            console.log(`Creating assignments for ${cloverleafHomeIds.length} Cloverleaf homes...`);
            
            for (const homeId of cloverleafHomeIds) {
                try {
                    await client.models.Assignment.create({
                        homeId: homeId,
                        volunteerId: volunteerToUse.id,
                        status: 'NOT_STARTED',
                        assignedAt: new Date().toISOString()
                    });
                    console.log(`✅ Created assignment for home ${homeId}`);
                } catch (error) {
                    console.log(`Assignment creation failed for ${homeId}:`, error.message);
                }
            }
        }
        
        // 4. Verify all data
        console.log('\n4. ✅ Final verification...');
        
        // Check 42927 Cloverleaf Ct residents
        const residents42927 = await client.models.Person.list({
            filter: { homeId: { eq: michaelHomeId } }
        });
        console.log(`42927 Cloverleaf Ct now has ${residents42927.data?.length || 0} residents:`);
        residents42927.data?.forEach(resident => {
            console.log(`  ${resident.firstName} ${resident.lastName} (${resident.role})`);
        });
        
        // Check 42931 Cloverleaf Ct residents
        const lutherHomeId = 'b54f3380-85c8-42b2-84fc-01d155d1ac52';
        const residents42931 = await client.models.Person.list({
            filter: { homeId: { eq: lutherHomeId } }
        });
        console.log(`42931 Cloverleaf Ct now has ${residents42931.data?.length || 0} residents:`);
        residents42931.data?.forEach(resident => {
            console.log(`  ${resident.firstName} ${resident.lastName} (${resident.role})`);
        });
        
        // Check volunteers
        const volunteers = await client.models.Volunteer.list();
        console.log(`\nVolunteers: ${volunteers.data?.length || 0}`);
        
        // Check assignments
        const assignments = await client.models.Assignment.list();
        console.log(`Assignments: ${assignments.data?.length || 0}`);
        
        // Check all Cloverleaf homes
        const allCloverleaf = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } }
        });
        console.log(`\nCloverleaf homes: ${allCloverleaf.data?.length || 0}`);
        allCloverleaf.data?.forEach(home => {
            console.log(`  ${home.street} (coords: ${home.lat}, ${home.lng})`);
        });
        
        console.log('\n🎉 Setup complete! The canvassing page should now work properly.');
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

createMissingMichael();