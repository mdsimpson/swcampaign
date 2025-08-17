import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function findHomesWithResidents() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('Looking for homes that actually have residents...')
        
        // Get all people and group by homeId
        let allPeople = []
        let nextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken
            })
            allPeople = allPeople.concat(result.data)
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Total people: ${allPeople.length}`)
        
        // Group people by homeId
        const peopleByHome = new Map()
        allPeople.forEach(person => {
            if (!peopleByHome.has(person.homeId)) {
                peopleByHome.set(person.homeId, [])
            }
            peopleByHome.get(person.homeId).push(person)
        })
        
        console.log(`Unique home IDs with residents: ${peopleByHome.size}`)
        
        // Find homes that exist and have residents
        let homesWithResidents = 0
        let exampleCount = 0
        
        for (const [homeId, residents] of peopleByHome) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId })
                if (homeResult.data) {
                    homesWithResidents++
                    if (exampleCount < 5) {
                        console.log(`\nExample ${exampleCount + 1}:`)
                        console.log(`  Home: ${homeResult.data.street}, ${homeResult.data.city}`)
                        console.log(`  Residents: ${residents.length}`)
                        residents.forEach(r => {
                            console.log(`    - ${r.firstName} ${r.lastName} (${r.role})`)
                        })
                        exampleCount++
                    }
                }
            } catch (e) {
                // Home doesn't exist - this shouldn't happen now that we verified relationships
            }
        }
        
        console.log(`\nHomes with residents: ${homesWithResidents}`)
        console.log(`Total homes: 29558`)
        console.log(`Homes without residents: ${29558 - homesWithResidents}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

findHomesWithResidents()