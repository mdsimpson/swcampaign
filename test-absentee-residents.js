import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testAbsenteeResidents() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING ABSENTEE HOME RESIDENTS ===')
        
        // Get absentee homes
        const absenteeResult = await client.models.Home.list({
            filter: { absenteeOwner: { eq: true } },
            limit: 5
        })
        
        console.log(`Found ${absenteeResult.data.length} absentee homes`)
        
        for (const home of absenteeResult.data) {
            console.log(`\n=== ${home.street}, ${home.city} ===`)
            console.log(`Home ID: ${home.id}`)
            console.log(`Property: ${home.street}, ${home.city}`)
            console.log(`Mailing: ${home.mailingStreet}, ${home.mailingCity}`)
            
            // Try to get residents for this home
            const residentsResult = await client.models.Person.list({
                filter: { homeId: { eq: home.id } }
            })
            
            console.log(`Residents found: ${residentsResult.data.length}`)
            
            if (residentsResult.data.length > 0) {
                residentsResult.data.forEach(person => {
                    console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
                })
            } else {
                console.log('  No residents found for this absentee home')
            }
        }
        
        // Also test if there are ANY people linked to absentee homes
        console.log('\n=== CHECKING ALL PEOPLE FOR ABSENTEE HOME LINKS ===')
        
        const absenteeHomeIds = new Set(absenteeResult.data.map(h => h.id))
        console.log('Absentee home IDs:', Array.from(absenteeHomeIds).slice(0, 3))
        
        // Get some people and see if any link to absentee homes
        const peopleResult = await client.models.Person.list({ limit: 50 })
        console.log(`Checking ${peopleResult.data.length} people...`)
        
        let linkedToAbsentee = 0
        peopleResult.data.forEach(person => {
            if (absenteeHomeIds.has(person.homeId)) {
                linkedToAbsentee++
                console.log(`Person ${person.firstName} ${person.lastName} linked to absentee home ${person.homeId}`)
            }
        })
        
        console.log(`Found ${linkedToAbsentee} people linked to absentee homes`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testAbsenteeResidents()