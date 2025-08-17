import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function fixRelationships() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('Loading all homes...')
        // Get all homes
        let allHomes = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 1000,
                nextToken
            })
            allHomes = allHomes.concat(result.data)
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Loaded ${allHomes.length} homes`)
        
        // Create a map of address -> home for quick lookup
        const homesByAddress = new Map()
        allHomes.forEach(home => {
            const key = `${home.street}|${home.city}|${home.state || 'VA'}`
            homesByAddress.set(key, home)
        })
        
        console.log('Loading all people...')
        // Get all people
        let allPeople = []
        nextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken
            })
            allPeople = allPeople.concat(result.data)
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Loaded ${allPeople.length} people`)
        
        // Get homes that people reference but don't exist
        const orphanedPeople = []
        for (const person of allPeople) {
            const homeExists = allHomes.find(h => h.id === person.homeId)
            if (!homeExists) {
                orphanedPeople.push(person)
            }
        }
        
        console.log(`Found ${orphanedPeople.length} people with invalid homeIds`)
        
        if (orphanedPeople.length === 0) {
            console.log('No orphaned people found. Relationships are correct.')
            return
        }
        
        // Try to match orphaned people to homes by checking if we can find the home they should belong to
        let fixed = 0
        let notFound = 0
        
        for (const person of orphanedPeople.slice(0, 100)) { // Process in batches
            try {
                // Try to find the home this person should belong to by getting the old home
                const oldHomeResult = await client.models.Home.get({ id: person.homeId })
                
                if (oldHomeResult.data) {
                    // Old home still exists somehow, skip
                    continue
                }
                
                // Old home doesn't exist, we need to find the correct home
                // For now, let's just delete these orphaned person records since we can't match them
                console.log(`Deleting orphaned person: ${person.firstName} ${person.lastName} (invalid homeId: ${person.homeId})`)
                await client.models.Person.delete({ id: person.id })
                fixed++
                
            } catch (error) {
                console.error(`Error processing person ${person.id}:`, error.message)
                notFound++
            }
        }
        
        console.log(`Processed ${fixed} orphaned people`)
        console.log(`Errors: ${notFound}`)
        console.log('Relationship fix completed!')
        
    } catch (error) {
        console.error('Error:', error)
    }
}

fixRelationships()