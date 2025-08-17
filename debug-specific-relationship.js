import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugSpecific() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        // Get the specific home we saw in debug
        const homeId = 'ecb9e696-dc2e-49c8-a77c-ca494437e65b'
        const homeResult = await client.models.Home.get({ id: homeId })
        
        if (homeResult.data) {
            console.log('=== HOME FOUND ===')
            console.log(`Address: ${homeResult.data.street}, ${homeResult.data.city}`)
            console.log(`ID: ${homeResult.data.id}`)
            
            // Try to get residents using the relationship
            try {
                console.log('\n=== TESTING RELATIONSHIP ===')
                const residentsViaQuery = await client.models.Person.list({ 
                    filter: { homeId: { eq: homeId } } 
                })
                console.log(`Residents via query: ${residentsViaQuery.data.length}`)
                
                // Check if any people have this exact homeId
                const peopleWithThisHomeId = await client.models.Person.list({ 
                    filter: { homeId: { eq: homeId } },
                    limit: 10
                })
                console.log(`People with this homeId: ${peopleWithThisHomeId.data.length}`)
                
                if (peopleWithThisHomeId.data.length > 0) {
                    peopleWithThisHomeId.data.forEach(person => {
                        console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
                    })
                }
                
            } catch (relationshipError) {
                console.error('Relationship error:', relationshipError)
            }
            
            // Let's also check if the Organize page is using a different auth mode
            console.log('\n=== TESTING WITH DIFFERENT AUTH MODES ===')
            
            try {
                const userPoolClient = generateClient({ authMode: 'userPool' })
                const userPoolResult = await userPoolClient.models.Person.list({ 
                    filter: { homeId: { eq: homeId } } 
                })
                console.log(`With userPool auth: ${userPoolResult.data.length} residents`)
            } catch (e) {
                console.log('UserPool auth failed:', e.message)
            }
            
        } else {
            console.log('Home not found')
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugSpecific()