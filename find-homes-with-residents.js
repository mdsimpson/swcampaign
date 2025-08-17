import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function findHomesWithResidents() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Finding Homes with Residents ===')
        
        // Get all people and their home IDs
        const peopleResult = await client.models.Person.list()
        const people = peopleResult.data
        console.log(`Total people: ${people.length}`)
        
        // Get unique home IDs that have residents
        const homeIdsWithResidents = [...new Set(people.map(p => p.homeId))]
        console.log(`Home IDs with residents: ${homeIdsWithResidents.length}`)
        
        // Look up these homes
        console.log('\nHomes that have residents:')
        const homesWithResidents = []
        
        for (const homeId of homeIdsWithResidents) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId })
                if (homeResult.data) {
                    const residentsForHome = people.filter(p => p.homeId === homeId)
                    homesWithResidents.push({
                        ...homeResult.data,
                        residents: residentsForHome
                    })
                } else {
                    console.log(`⚠️ Home ID ${homeId} has residents but home doesn't exist`)
                }
            } catch (error) {
                console.log(`❌ Error fetching home ${homeId}: ${error.message}`)
            }
        }
        
        console.log(`\nFound ${homesWithResidents.length} homes with residents:`)
        homesWithResidents.forEach((home, i) => {
            const address = home.unitNumber && home.street && home.unitNumber !== home.street 
                ? `${home.unitNumber} ${home.street}` 
                : (home.street || home.unitNumber)
            
            console.log(`${i+1}. ${address}, ${home.city} - Absentee: ${home.absenteeOwner}`)
            console.log(`   ID: ${home.id}`)
            console.log(`   Residents: ${home.residents.map(r => `${r.firstName} ${r.lastName}`).join(', ')}`)
            console.log()
        })
        
        // Check if these homes appear in filtered queries
        console.log('=== Checking if homes with residents appear in filtered queries ===')
        
        const nonAbsenteeWithResidents = homesWithResidents.filter(h => !h.absenteeOwner)
        const absenteeWithResidents = homesWithResidents.filter(h => h.absenteeOwner)
        
        console.log(`Non-absentee homes with residents: ${nonAbsenteeWithResidents.length}`)
        console.log(`Absentee homes with residents: ${absenteeWithResidents.length}`)
        
        // Test if these homes show up in list queries
        console.log('\n--- Testing list query for non-absentee homes ---')
        const nonAbsenteeQuery = await client.models.Home.list({
            filter: { absenteeOwner: { ne: true } }
        })
        
        const queriedHomeIds = new Set(nonAbsenteeQuery.data.map(h => h.id))
        const residentsHomeIds = new Set(nonAbsenteeWithResidents.map(h => h.id))
        
        console.log(`Query returned ${nonAbsenteeQuery.data.length} homes`)
        console.log(`Homes with residents that should be in query: ${nonAbsenteeWithResidents.length}`)
        
        const intersection = nonAbsenteeWithResidents.filter(h => queriedHomeIds.has(h.id))
        console.log(`Homes with residents that ARE in query results: ${intersection.length}`)
        
        if (intersection.length === 0) {
            console.log('\n⚠️ PROBLEM: Homes with residents are NOT appearing in the list query!')
            console.log('This suggests the homes with residents have different filter criteria.')
            
            // Check the actual filter values
            console.log('\nChecking actual absenteeOwner values for homes with residents:')
            nonAbsenteeWithResidents.forEach(home => {
                console.log(`${home.street}: absenteeOwner = ${home.absenteeOwner} (${typeof home.absenteeOwner})`)
            })
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

findHomesWithResidents()