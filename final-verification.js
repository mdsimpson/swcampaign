import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function finalVerification() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Final Verification Before Cleanup ===')
        
        // All homes in database
        const allHomesResult = await client.models.Home.list()
        console.log(`Total homes in database: ${allHomesResult.data.length}`)
        
        // All people in database
        const allPeopleResult = await client.models.Person.list()
        console.log(`Total people in database: ${allPeopleResult.data.length}`)
        
        // Home IDs with residents
        const homeIdsWithResidents = new Set(allPeopleResult.data.map(p => p.homeId))
        console.log(`Unique home IDs with residents: ${homeIdsWithResidents.size}`)
        
        // Homes from list query 
        const listHomes = allHomesResult.data
        const listHomeIds = new Set(listHomes.map(h => h.id))
        
        // Check overlap
        const overlappingIds = [...listHomeIds].filter(id => homeIdsWithResidents.has(id))
        console.log(`Homes that exist in BOTH list query AND have residents: ${overlappingIds.length}`)
        
        // This means the homes with residents are NOT showing up in list queries
        // Let me check if they can be fetched individually
        console.log('\n--- Checking if homes with residents exist but are not returned by list() ---')
        
        const sampleResidentHomeIds = [...homeIdsWithResidents].slice(0, 3)
        
        for (const homeId of sampleResidentHomeIds) {
            try {
                const directFetch = await client.models.Home.get({ id: homeId })
                if (directFetch.data) {
                    console.log(`✓ Home ${homeId} exists via direct fetch: ${directFetch.data.street}`)
                    console.log(`  absenteeOwner: ${directFetch.data.absenteeOwner}`)
                } else {
                    console.log(`✗ Home ${homeId} does not exist via direct fetch`)
                }
            } catch (error) {
                console.log(`❌ Error fetching home ${homeId}: ${error.message}`)
            }
        }
        
        // The question is: why aren't these homes showing up in list() queries?
        // Let me try to get all homes without any filters
        console.log('\n--- Testing unfiltered list query ---')
        const unfilteredResult = await client.models.Home.list()
        const unfilteredIds = new Set(unfilteredResult.data.map(h => h.id))
        
        const residentsInUnfiltered = [...homeIdsWithResidents].filter(id => unfilteredIds.has(id))
        console.log(`Homes with residents that show up in unfiltered list(): ${residentsInUnfiltered.length}`)
        
        if (residentsInUnfiltered.length === 0) {
            console.log('\n🚨 CRITICAL: Homes with residents do NOT appear in ANY list() query!')
            console.log('This suggests they exist in a different table or have different authorization.')
        } else {
            console.log(`\n✅ Homes with residents DO appear in unfiltered list queries`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

finalVerification()