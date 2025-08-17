import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('./amplify_outputs.json', 'utf8'));
Amplify.configure(outputs, { ssr: true });
const client = generateClient({ authMode: 'apiKey' });

async function checkSpecificHome() {
    console.log('Checking for 42915 Cloverleaf Ct...');
    
    try {
        // Get all homes and find the specific one
        const homesResult = await client.models.Home.list();
        console.log(`Found ${homesResult.data.length} total homes`);
        
        const targetHome = homesResult.data.find(h => 
            h.street === '42915 Cloverleaf Ct' || 
            h.street.includes('42915 Cloverleaf')
        );
        
        if (targetHome) {
            console.log('Found target home:');
            console.log('ID:', targetHome.id);
            console.log('Street:', targetHome.street);
            console.log('City:', targetHome.city);
            console.log('State:', targetHome.state);
            console.log('Postal Code:', targetHome.postalCode);
            console.log('Latitude:', targetHome.lat);
            console.log('Longitude:', targetHome.lng);
            console.log('Has coordinates?', targetHome.lat && targetHome.lng ? 'YES' : 'NO');
        } else {
            console.log('❌ Target home not found!');
            
            // Show all homes with "Cloverleaf" in the street name
            const cloverleafHomes = homesResult.data.filter(h => 
                h.street && h.street.toLowerCase().includes('cloverleaf')
            );
            
            console.log(`\nFound ${cloverleafHomes.length} homes with 'cloverleaf' in the street name:`);
            cloverleafHomes.forEach(home => {
                console.log(`- ${home.street}, ${home.city}, ${home.state} ${home.postalCode || ''} (lat: ${home.lat || 'none'}, lng: ${home.lng || 'none'})`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSpecificHome();