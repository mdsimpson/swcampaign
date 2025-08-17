import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugResidents() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        // Get first few homes
        const homesResult = await client.models.Home.list({ limit: 3 })
        console.log('=== HOMES AND RESIDENTS DEBUG ===')
        
        for (const home of homesResult.data) {
            console.log(`\nHome: ${home.street}, ${home.city}`)
            console.log(`Home ID: ${home.id}`)
            
            // Get residents for this home
            const residentsResult = await client.models.Person.list({ 
                filter: { homeId: { eq: home.id } } 
            })
            
            console.log(`Residents found: ${residentsResult.data.length}`)
            residentsResult.data.forEach((person, i) => {
                console.log(`  ${i+1}. ${person.firstName || '[no first]'} ${person.lastName || '[no last]'} (${person.role || 'no role'})`)
                console.log(`     Person ID: ${person.id}`)
                console.log(`     Home ID: ${person.homeId}`)
            })
            
            // Also try to get residents via the relationship
            try {
                if (home.residents) {
                    console.log(`Direct residents relationship: ${home.residents.length || 0}`)
                }
            } catch (e) {
                console.log('No direct residents relationship data')
            }
        }
        
        // Check if there are any people with missing names
        console.log('\n=== CHECKING FOR PEOPLE WITH MISSING NAMES ===')
        const allPeopleResult = await client.models.Person.list({ limit: 20 })
        console.log(`Total people sample: ${allPeopleResult.data.length}`)
        
        let withNames = 0, withoutNames = 0
        allPeopleResult.data.forEach(person => {
            if (person.firstName || person.lastName) {
                withNames++
            } else {
                withoutNames++
                console.log(`Person without name: ID ${person.id}, Home ID ${person.homeId}, Role: ${person.role}`)
            }
        })
        
        console.log(`People with names: ${withNames}`)
        console.log(`People without names: ${withoutNames}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugResidents()