import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testRelationships() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Testing ID Relationships ===')
        
        // Get first few homes
        const homesResult = await client.models.Home.list({ limit: 5 })
        console.log(`Found ${homesResult.data.length} homes`)
        
        // Get first few people
        const peopleResult = await client.models.Person.list({ limit: 10 })
        console.log(`Found ${peopleResult.data.length} people`)
        
        console.log('\nHomes IDs:')
        homesResult.data.forEach(home => {
            console.log(`- ${home.id} (${home.street})`)
        })
        
        console.log('\nPeople linked to Home IDs:')
        const uniqueHomeIds = [...new Set(peopleResult.data.map(p => p.homeId))]
        uniqueHomeIds.forEach(homeId => {
            const peopleForHome = peopleResult.data.filter(p => p.homeId === homeId)
            console.log(`- ${homeId}: ${peopleForHome.map(p => `${p.firstName} ${p.lastName}`).join(', ')}`)
        })
        
        console.log('\nChecking if person home IDs exist in homes table:')
        for (const homeId of uniqueHomeIds) {
            const homeResult = await client.models.Home.get({ id: homeId })
            if (homeResult.data) {
                console.log(`✓ Home ${homeId} exists: ${homeResult.data.street}`)
            } else {
                console.log(`✗ Home ${homeId} does not exist`)
            }
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

testRelationships()