import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugIds() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        // Get sample homes
        const homesResult = await client.models.Home.list({ limit: 5 })
        console.log('=== HOME IDS ===')
        homesResult.data.forEach((home, i) => {
            console.log(`${i+1}. ${home.street} - ID: ${home.id}`)
        })
        
        // Get sample people
        const peopleResult = await client.models.Person.list({ limit: 10 })
        console.log('\n=== PERSON HOME IDS ===')
        peopleResult.data.forEach((person, i) => {
            console.log(`${i+1}. ${person.firstName} ${person.lastName} - Home ID: ${person.homeId}`)
        })
        
        // Check if any home IDs match person homeIds
        console.log('\n=== CHECKING FOR MATCHES ===')
        const homeIds = new Set(homesResult.data.map(h => h.id))
        const personHomeIds = new Set(peopleResult.data.map(p => p.homeId))
        
        console.log(`Unique home IDs: ${homeIds.size}`)
        console.log(`Unique person homeIds: ${personHomeIds.size}`)
        
        const intersection = new Set([...homeIds].filter(id => personHomeIds.has(id)))
        console.log(`Matching IDs: ${intersection.size}`)
        
        if (intersection.size > 0) {
            console.log('Matches found:', [...intersection])
        } else {
            console.log('No matches found!')
            console.log('Sample home IDs:', [...homeIds].slice(0, 3))
            console.log('Sample person homeIds:', [...personHomeIds].slice(0, 3))
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugIds()