import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function addViralMasalia() {
    console.log('🎯 ADDING VIRAL MASALIA TO 42923 CLOVERLEAF CT\n');
    
    try {
        // Step 1: Find all address records for 42923 Cloverleaf Ct
        console.log('1. Finding address records for 42923 Cloverleaf Ct...');
        
        const addressesResult = await client.models.Address.list({ limit: 5000 });
        const cloverleafAddresses = addressesResult.data.filter(addr => 
            addr.street?.toLowerCase().includes('42923 cloverleaf')
        );
        
        console.log(`   Found ${cloverleafAddresses.length} address records:`);
        cloverleafAddresses.forEach(addr => {
            console.log(`   - ID: ${addr.id}, Street: ${addr.street}`);
        });
        
        if (cloverleafAddresses.length === 0) {
            console.log('❌ No address records found for 42923 Cloverleaf Ct');
            return;
        }
        
        // Step 2: Check if Viral Masalia is already there
        console.log('\n2. Checking if Viral Masalia is already a resident...');
        
        const residentsResult = await client.models.Resident.list({ limit: 5000 });
        const viralResidents = residentsResult.data.filter(r => 
            r.firstName?.toLowerCase() === 'viral' && 
            r.lastName?.toLowerCase() === 'masalia'
        );
        
        console.log(`   Found ${viralResidents.length} Viral Masalia residents:`);
        viralResidents.forEach(r => {
            console.log(`   - Address ID: ${r.addressId}, Name: ${r.firstName} ${r.lastName}`);
        });
        
        // Check if already at any Cloverleaf address
        const addressIds = cloverleafAddresses.map(a => a.id);
        const alreadyAtCloverleaf = viralResidents.some(r => 
            addressIds.includes(r.addressId)
        );
        
        if (alreadyAtCloverleaf) {
            console.log('✅ Viral Masalia is already listed at 42923 Cloverleaf Ct');
            return;
        }
        
        // Step 3: Add Viral Masalia to each address record for 42923 Cloverleaf Ct
        console.log('\n3. Adding Viral Masalia as property owner...');
        
        for (const address of cloverleafAddresses) {
            try {
                console.log(`   Adding to address ID: ${address.id}`);
                
                await client.models.Resident.create({
                    addressId: address.id,
                    firstName: 'Viral',
                    lastName: 'Masalia',
                    occupantType: 'Official Owner',
                    contactEmail: 'vmgovir@gmail.com',
                    cellPhone: '908-242-7654',
                    isAbsentee: true // They don't live at this property, they live at Pagoda Ter
                });
                
                console.log(`   ✅ Successfully added Viral Masalia to ${address.street}`);
                
            } catch (error) {
                console.log(`   ❌ Failed to add to ${address.id}: ${error.message}`);
            }
        }
        
        console.log('\n🎉 PROCESS COMPLETE!');
        console.log('Viral Masalia should now appear in the 42923 Cloverleaf Ct popup as an absentee owner.');
        
    } catch (error) {
        console.error('💥 Error:', error);
    }
}

addViralMasalia();