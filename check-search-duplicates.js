import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function checkSearchDuplicates() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== CHECKING FOR SEARCH DUPLICATES ===')
        
        // Test the Simpson search that shows duplicates
        console.log('\n1. Testing Simpson name search...')
        
        // Get ALL people first for resident filtering
        let allPeople = []
        let peopleNextToken = null
        
        do {
            const peopleResult = await client.models.Person.list({ 
                limit: 1000,
                nextToken: peopleNextToken
            })
            allPeople.push(...peopleResult.data)
            peopleNextToken = peopleResult.nextToken
        } while (peopleNextToken)
        
        console.log(`Total people: ${allPeople.length}`)
        
        // Find Simpson residents
        const simpsonPeople = allPeople.filter(person => 
            (person.firstName?.toLowerCase().includes('simpson')) ||
            (person.lastName?.toLowerCase().includes('simpson')) ||
            (`${person.firstName} ${person.lastName}`.toLowerCase().includes('simpson'))
        )
        
        console.log(`Simpson people found: ${simpsonPeople.length}`)
        simpsonPeople.forEach(person => {
            console.log(`  - ${person.firstName} ${person.lastName} (${person.role}) at home ${person.homeId.substring(0, 8)}...`)
        })
        
        const simpsonHomeIds = [...new Set(simpsonPeople.map(p => p.homeId))]
        console.log(`Unique Simpson home IDs: ${simpsonHomeIds.length}`)
        
        // Get the actual homes for Simpson residents
        console.log('\n2. Getting home details for Simpson addresses...')
        const simpsonHomes = []
        
        for (const homeId of simpsonHomeIds) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId })
                if (homeResult.data) {
                    simpsonHomes.push(homeResult.data)
                }
            } catch (error) {
                console.error(`Error getting home ${homeId}:`, error.message)
            }
        }
        
        console.log(`Simpson homes retrieved: ${simpsonHomes.length}`)
        
        // Check for duplicate addresses
        const addressCounts = {}
        simpsonHomes.forEach(home => {
            const address = `${home.street}, ${home.city}`.toLowerCase()
            addressCounts[address] = (addressCounts[address] || 0) + 1
        })
        
        console.log('\n3. Address frequency analysis:')
        Object.entries(addressCounts).forEach(([address, count]) => {
            console.log(`  ${address}: ${count} ${count > 1 ? '⚠️ DUPLICATE' : '✓'}`)
        })
        
        // Now test the actual search logic from the UI
        console.log('\n4. Testing UI search logic simulation...')
        
        let searchResults = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                // This mimics the UI filtering logic
                if (simpsonHomeIds.includes(home.id)) {
                    searchResults.push(home)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken && searchResults.length < 500)
        
        console.log(`UI search simulation found: ${searchResults.length} homes`)
        
        // Check for duplicates in search results
        const searchIds = searchResults.map(h => h.id)
        const uniqueSearchIds = [...new Set(searchIds)]
        
        if (searchIds.length !== uniqueSearchIds.length) {
            console.log(`⚠️ FOUND ${searchIds.length - uniqueSearchIds.length} DUPLICATES in search results`)
            
            // Find the duplicate IDs
            const duplicateIds = searchIds.filter((id, index) => searchIds.indexOf(id) !== index)
            console.log('Duplicate home IDs:', duplicateIds.map(id => id.substring(0, 8) + '...'))
        } else {
            console.log('✓ No duplicates found in search results')
        }
        
        // Show the final addresses that would appear in UI
        console.log('\n5. Final addresses that would show in UI:')
        const uniqueHomes = searchResults.filter((home, index, self) => 
            index === self.findIndex(h => h.id === home.id)
        )
        
        uniqueHomes.forEach(home => {
            const residents = allPeople.filter(p => p.homeId === home.id)
            console.log(`  ${home.street}, ${home.city} (${residents.length} residents)`)
            residents.forEach(resident => {
                console.log(`    - ${resident.firstName} ${resident.lastName} (${resident.role})`)
            })
        })
        
    } catch (error) {
        console.error('Error:', error)
    }
}

checkSearchDuplicates()