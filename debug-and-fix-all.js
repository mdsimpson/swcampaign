import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function debugAndFixAll() {
    console.log('🔧 Complete debug and fix for canvassing issues...');
    
    try {
        // 1. First, let's check what actually exists
        console.log('\n1. 📊 Current database state...');
        
        const allVolunteers = await client.models.Volunteer.list();
        console.log(`Volunteers: ${allVolunteers.data?.length || 0}`);
        
        const allAssignments = await client.models.Assignment.list();
        console.log(`Assignments: ${allAssignments.data?.length || 0}`);
        
        const allHomes = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } }
        });
        console.log(`Cloverleaf homes: ${allHomes.data?.length || 0}`);
        
        const allPeople = await client.models.Person.list();
        console.log(`Total people: ${allPeople.data?.length || 0}`);
        
        // 2. Create all Cloverleaf homes properly
        console.log('\n2. 🏠 Ensuring all Cloverleaf homes exist...');
        
        const targetHomes = [
            { street: '42919 Cloverleaf Ct', lat: 39.0064, lng: -77.5165 },
            { street: '42927 Cloverleaf Ct', lat: 39.0066, lng: -77.5164 },
            { street: '42931 Cloverleaf Ct', lat: 39.0057, lng: -77.3733 },
            { street: '42942 Cloverleaf Ct', lat: 39.0068, lng: -77.5163 }
        ];
        
        const homeIds = {};
        
        for (const targetHome of targetHomes) {
            const existingHome = await client.models.Home.list({
                filter: { street: { eq: targetHome.street } }
            });
            
            if (existingHome.data?.length > 0) {
                console.log(`✅ ${targetHome.street} already exists`);
                homeIds[targetHome.street] = existingHome.data[0].id;
            } else {
                console.log(`🆕 Creating ${targetHome.street}...`);
                try {
                    const newHome = await client.models.Home.create({
                        street: targetHome.street,
                        city: 'Broadlands',
                        state: 'VA',
                        absenteeOwner: false,
                        lat: targetHome.lat,
                        lng: targetHome.lng
                    });
                    homeIds[targetHome.street] = newHome.data.id;
                    console.log(`✅ Created ${targetHome.street} with ID ${newHome.data.id}`);
                } catch (error) {
                    console.error(`❌ Failed to create ${targetHome.street}:`, error.message);
                }
            }
        }
        
        console.log('\nHome IDs:');
        Object.entries(homeIds).forEach(([address, id]) => {
            console.log(`  ${address}: ${id}`);
        });
        
        // 3. Create residents
        console.log('\n3. 👥 Creating residents...');
        
        const targetResidents = [
            { firstName: 'Michael', lastName: 'Simpson', home: '42927 Cloverleaf Ct', role: 'PRIMARY_OWNER' },
            { firstName: 'Oya', lastName: 'Simpson', home: '42927 Cloverleaf Ct', role: 'SECONDARY_OWNER' },
            { firstName: 'Luther', lastName: 'Williams', home: '42931 Cloverleaf Ct', role: 'PRIMARY_OWNER' },
            { firstName: 'Rebecca', lastName: 'Williams', home: '42931 Cloverleaf Ct', role: 'SECONDARY_OWNER' }
        ];
        
        for (const resident of targetResidents) {
            // Check if resident already exists
            const existingResident = await client.models.Person.list({
                filter: { 
                    firstName: { eq: resident.firstName },
                    lastName: { eq: resident.lastName },
                    homeId: { eq: homeIds[resident.home] }
                }
            });
            
            if (existingResident.data?.length > 0) {
                console.log(`✅ ${resident.firstName} ${resident.lastName} already exists`);
            } else {
                console.log(`🆕 Creating ${resident.firstName} ${resident.lastName}...`);
                try {
                    await client.models.Person.create({
                        homeId: homeIds[resident.home],
                        firstName: resident.firstName,
                        lastName: resident.lastName,
                        role: resident.role,
                        hasSigned: false
                    });
                    console.log(`✅ Created ${resident.firstName} ${resident.lastName}`);
                } catch (error) {
                    console.error(`❌ Failed to create ${resident.firstName} ${resident.lastName}:`, error.message);
                }
            }
        }
        
        // 4. Create volunteer
        console.log('\n4. 👤 Creating volunteer...');
        
        const existingVolunteer = await client.models.Volunteer.list();
        let volunteer = null;
        
        if (existingVolunteer.data?.length > 0) {
            volunteer = existingVolunteer.data[0];
            console.log(`✅ Using existing volunteer: ${volunteer.displayName}`);
        } else {
            try {
                const newVolunteer = await client.models.Volunteer.create({
                    userSub: 'secretary-user-sub-123',
                    displayName: 'Secretary User',
                    email: 'secretary2023@swhoab.com'
                });
                volunteer = newVolunteer.data;
                console.log(`✅ Created volunteer: ${volunteer.displayName}`);
            } catch (error) {
                console.error('❌ Failed to create volunteer:', error.message);
            }
        }
        
        // 5. Create assignments
        console.log('\n5. 📋 Creating assignments...');
        
        if (volunteer) {
            const assignmentHomes = ['42919 Cloverleaf Ct', '42927 Cloverleaf Ct', '42931 Cloverleaf Ct', '42942 Cloverleaf Ct'];
            
            for (const homeAddress of assignmentHomes) {
                if (homeIds[homeAddress]) {
                    // Check if assignment already exists
                    const existingAssignment = await client.models.Assignment.list({
                        filter: { 
                            homeId: { eq: homeIds[homeAddress] },
                            volunteerId: { eq: volunteer.id }
                        }
                    });
                    
                    if (existingAssignment.data?.length > 0) {
                        console.log(`✅ Assignment for ${homeAddress} already exists`);
                    } else {
                        try {
                            await client.models.Assignment.create({
                                homeId: homeIds[homeAddress],
                                volunteerId: volunteer.id,
                                status: 'NOT_STARTED',
                                assignedAt: new Date().toISOString()
                            });
                            console.log(`✅ Created assignment for ${homeAddress}`);
                        } catch (error) {
                            console.error(`❌ Failed to create assignment for ${homeAddress}:`, error.message);
                        }
                    }
                }
            }
        }
        
        // 6. Final verification
        console.log('\n6. ✅ Final verification...');
        
        // Check each home
        for (const homeAddress of Object.keys(homeIds)) {
            const residents = await client.models.Person.list({
                filter: { homeId: { eq: homeIds[homeAddress] } }
            });
            
            console.log(`${homeAddress} (${homeIds[homeAddress]}):`);
            console.log(`  Residents: ${residents.data?.length || 0}`);
            residents.data?.forEach(resident => {
                console.log(`    ${resident.firstName} ${resident.lastName} (${resident.role})`);
            });
        }
        
        // Check volunteers and assignments
        const finalVolunteers = await client.models.Volunteer.list();
        console.log(`\nTotal volunteers: ${finalVolunteers.data?.length || 0}`);
        
        const finalAssignments = await client.models.Assignment.list();
        console.log(`Total assignments: ${finalAssignments.data?.length || 0}`);
        finalAssignments.data?.forEach(assignment => {
            const home = Object.entries(homeIds).find(([addr, id]) => id === assignment.homeId);
            console.log(`  Assignment: ${home ? home[0] : assignment.homeId} -> Volunteer ${assignment.volunteerId} (${assignment.status})`);
        });
        
        console.log('\n🎉 All data setup complete! Try refreshing the canvassing page.');
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    }
}

debugAndFixAll();