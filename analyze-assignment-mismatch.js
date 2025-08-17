import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function analyzeAssignmentMismatch() {
    console.log('🔍 ANALYZING ASSIGNMENT MISMATCH\n');
    
    try {
        // Get secretary volunteer
        const volunteers = await client.models.Volunteer.list();
        const secretary = volunteers.data.find(v => v.email === 'secretary2023@swhoab.com');
        
        // Get ALL assignments for secretary (including completed ones)
        const allAssignments = await client.models.Assignment.list({
            filter: { volunteerId: { eq: secretary.id } }
        });
        
        console.log('ALL assignments for Secretary Simpson:');
        console.log(`Total assignments found: ${allAssignments.data.length}`);
        
        // Status breakdown
        const statusCounts = {};
        allAssignments.data.forEach(a => {
            statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
        });
        
        console.log('\nStatus breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
        });
        
        // Get detailed assignment info
        console.log('\n📋 DETAILED ASSIGNMENT LIST:');
        const assignmentDetails = [];
        
        for (let i = 0; i < allAssignments.data.length; i++) {
            const assignment = allAssignments.data[i];
            
            try {
                const home = await client.models.Home.get({ id: assignment.homeId });
                const detail = {
                    status: assignment.status,
                    address: home.data ? home.data.street : 'Unknown',
                    homeId: assignment.homeId,
                    assignmentId: assignment.id,
                    createdAt: assignment.createdAt,
                    hasCoords: home.data && home.data.lat && home.data.lng
                };
                
                assignmentDetails.push(detail);
                
                console.log(`${i + 1}. [${detail.status}] ${detail.address}`);
                console.log(`   Assignment ID: ${detail.assignmentId}`);
                console.log(`   Home ID: ${detail.homeId}`);
                console.log(`   Has coordinates: ${detail.hasCoords ? 'Yes' : 'No'}`);
                console.log(`   Created: ${detail.createdAt}`);
                console.log('');
                
            } catch (error) {
                console.log(`${i + 1}. [${assignment.status}] Error loading home`);
                console.log(`   Assignment ID: ${assignment.id}`);
                console.log(`   Home ID: ${assignment.homeId}`);
                console.log(`   Error: ${error.message}`);
                console.log('');
            }
        }
        
        // Check for duplicate addresses
        console.log('🏠 ADDRESS ANALYSIS:');
        const addressCounts = {};
        assignmentDetails.forEach(detail => {
            addressCounts[detail.address] = (addressCounts[detail.address] || 0) + 1;
        });
        
        console.log('Address frequency:');
        Object.entries(addressCounts).forEach(([address, count]) => {
            console.log(`  ${address}: ${count} assignment${count > 1 ? 's' : ''}`);
        });
        
        // Map display analysis
        console.log('\n🗺️ MAP DISPLAY ANALYSIS:');
        const activeAssignments = assignmentDetails.filter(d => d.status === 'NOT_STARTED');
        const withCoords = activeAssignments.filter(d => d.hasCoords);
        const uniqueHomeIds = [...new Set(activeAssignments.map(a => a.homeId))];
        const uniqueAddresses = [...new Set(activeAssignments.map(a => a.address))];
        
        console.log(`• Active assignments (NOT_STARTED): ${activeAssignments.length}`);
        console.log(`• With coordinates: ${withCoords.length}`);
        console.log(`• Unique home IDs: ${uniqueHomeIds.length}`);
        console.log(`• Unique addresses: ${uniqueAddresses.length}`);
        
        console.log('\n💡 LIKELY EXPLANATION:');
        if (activeAssignments.length > uniqueAddresses.length) {
            console.log('Multiple assignments point to the same address.');
            console.log('The map shows unique addresses, not individual assignments.');
            console.log(`Assignments: ${activeAssignments.length}, Unique markers: ${uniqueAddresses.length}`);
        }
        
        if (withCoords.length !== activeAssignments.length) {
            console.log(`${activeAssignments.length - withCoords.length} assignments lack coordinates and won't show on map.`);
        }
        
        // Check if canvassing map deduplicates by home ID
        console.log('\nCanvassing map logic likely shows unique homes, not individual assignments.');
        console.log('If multiple assignments exist for the same home, only one marker appears.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

analyzeAssignmentMismatch();