import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function compareHomeSets() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Comparing Home Sets ===')
        
        // Get homes from list query (the ones appearing in UI)
        const listQueryResult = await client.models.Home.list({
            filter: { absenteeOwner: { ne: true } }
        })
        console.log(`Homes from list query: ${listQueryResult.data.length}`)
        
        // Get all people and their home IDs (homes with residents)
        const peopleResult = await client.models.Person.list()
        const homeIdsWithResidents = [...new Set(peopleResult.data.map(p => p.homeId))]
        console.log(`Unique home IDs that have residents: ${homeIdsWithResidents.length}`)
        
        // Check for overlap
        const listQueryHomeIds = new Set(listQueryResult.data.map(h => h.id))
        const residentHomeIds = new Set(homeIdsWithResidents)
        
        const overlap = [...listQueryHomeIds].filter(id => residentHomeIds.has(id))
        console.log(`Homes that appear in BOTH sets: ${overlap.length}`)
        
        if (overlap.length === 0) {
            console.log('\n🚨 CONFIRMED: There are two completely separate sets of Home records!')
            console.log('   - One set appears in list queries (UI sees these)')
            console.log('   - Another set has residents linked to them')
            console.log('   - These sets do not overlap at all')
        }
        
        // Show examples from each set
        console.log('\n--- Sample from List Query Results (No Residents) ---')
        listQueryResult.data.slice(0, 5).forEach((home, i) => {
            const address = home.unitNumber && home.street && home.unitNumber !== home.street 
                ? `${home.unitNumber} ${home.street}` 
                : (home.street || home.unitNumber)
            console.log(`${i+1}. ${home.id} - ${address}`)
        })
        
        console.log('\n--- Sample from Homes with Residents ---')
        for (let i = 0; i < Math.min(5, homeIdsWithResidents.length); i++) {
            const homeId = homeIdsWithResidents[i]
            try {
                const homeResult = await client.models.Home.get({ id: homeId })
                if (homeResult.data) {
                    const home = homeResult.data
                    const address = home.unitNumber && home.street && home.unitNumber !== home.street 
                        ? `${home.unitNumber} ${home.street}` 
                        : (home.street || home.unitNumber)
                    console.log(`${i+1}. ${home.id} - ${address}`)
                }
            } catch (error) {
                console.log(`${i+1}. ${homeId} - ERROR: ${error.message}`)
            }
        }
        
        // Check if duplicate addresses exist
        console.log('\n--- Checking for Duplicate Addresses ---')
        const allHomesResult = await client.models.Home.list()
        const allHomes = allHomesResult.data
        console.log(`Total homes in database: ${allHomes.length}`)
        
        const addressCounts = new Map()
        allHomes.forEach(home => {
            const key = `${home.street}|${home.city}|${home.state}`
            addressCounts.set(key, (addressCounts.get(key) || 0) + 1)
        })
        
        const duplicates = Array.from(addressCounts.entries()).filter(([addr, count]) => count > 1)
        console.log(`Addresses with duplicate entries: ${duplicates.length}`)
        
        if (duplicates.length > 0) {
            console.log('\nSample duplicates:')
            duplicates.slice(0, 10).forEach(([addr, count]) => {
                const [street, city, state] = addr.split('|')
                console.log(`  ${street}, ${city} ${state}: ${count} records`)
            })
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

compareHomeSets()