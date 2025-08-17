import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testSpecificHome() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        // Find Govardhan Borra's home
        console.log('Looking for Govardhan Borra...')
        const peopleResult = await client.models.Person.list({
            filter: { firstName: { eq: 'Govardhan' } }
        })
        
        if (peopleResult.data.length > 0) {
            const person = peopleResult.data[0]
            console.log(`Found: ${person.firstName} ${person.lastName}`)
            console.log(`Home ID: ${person.homeId}`)
            
            // Get the home
            const homeResult = await client.models.Home.get({ id: person.homeId })
            if (homeResult.data) {
                const home = homeResult.data
                console.log(`Home: ${home.street}, ${home.city}`)
                console.log(`Absentee: ${home.absenteeOwner}`)
                
                // Now test the same query that Organize page uses
                console.log('\n=== Testing Organize page query ===')
                const residentsResult = await client.models.Person.list({ 
                    filter: { homeId: { eq: home.id } } 
                })
                console.log(`Residents found: ${residentsResult.data.length}`)
                residentsResult.data.forEach(resident => {
                    console.log(`  - ${resident.firstName} ${resident.lastName} (${resident.role})`)
                })
                
                // Test if this home would be included in Organize filter
                console.log('\n=== Testing if home passes Organize filter ===')
                const homeFilterResult = await client.models.Home.list({
                    filter: { 
                        and: [
                            { id: { eq: home.id } },
                            { absenteeOwner: { ne: true } }
                        ]
                    }
                })
                console.log(`Home passes filter: ${homeFilterResult.data.length > 0}`)
            }
        } else {
            console.log('Govardhan not found')
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testSpecificHome()