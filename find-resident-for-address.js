import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function findResidentForAddress() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== FINDING RESIDENTS FOR ABSENTEE ADDRESS ===')
        
        // Look for the absentee home we found
        const targetAddress = '43318 Fullerton St'
        
        console.log(`Looking for residents at: ${targetAddress}`)
        
        // First, find ALL homes with this address
        console.log('\n1. Finding all homes with this address...')
        
        let allHomes = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                if (home.street && home.street.includes('43318 Fullerton')) {
                    allHomes.push(home)
                    console.log(`Found home: ${home.street}, ${home.city}`)
                    console.log(`  ID: ${home.id}`)
                    console.log(`  AbsenteeOwner: ${home.absenteeOwner}`)
                    console.log(`  Mailing: ${home.mailingStreet || 'N/A'}`)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken && allHomes.length < 10)
        
        console.log(`\nFound ${allHomes.length} homes with this address`)
        
        // Now check residents for each home
        console.log('\n2. Checking residents for each home...')
        
        for (const home of allHomes) {
            const residentsResult = await client.models.Person.list({
                filter: { homeId: { eq: home.id } }
            })
            
            console.log(`\nHome ${home.id} (${home.street}):`)
            console.log(`  AbsenteeOwner: ${home.absenteeOwner}`)
            console.log(`  Residents: ${residentsResult.data.length}`)
            
            if (residentsResult.data.length > 0) {
                residentsResult.data.forEach(person => {
                    console.log(`    - ${person.firstName} ${person.lastName} (${person.role})`)
                })
            }
        }
        
        // Also search for people by name or other means
        console.log('\n3. Looking for people who might live at this address...')
        
        const allPeople = await client.models.Person.list({ limit: 500 })
        console.log(`Checking ${allPeople.data.length} people...`)
        
        // Group people by homeId to see what homes have residents
        const peopleByHome = new Map()
        allPeople.data.forEach(person => {
            if (!peopleByHome.has(person.homeId)) {
                peopleByHome.set(person.homeId, [])
            }
            peopleByHome.get(person.homeId).push(person)
        })
        
        console.log(`People are distributed across ${peopleByHome.size} different homes`)
        
        // Check if any of the homeIds in peopleByHome match our target address homes
        for (const homeId of peopleByHome.keys()) {
            const home = allHomes.find(h => h.id === homeId)
            if (home) {
                const residents = peopleByHome.get(homeId)
                console.log(`Match found! Home ${home.street} has ${residents.length} residents`)
                residents.forEach(person => {
                    console.log(`  - ${person.firstName} ${person.lastName}`)
                })
            }
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

findResidentForAddress()