import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testCurrentState() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING CURRENT DATABASE STATE ===')
        
        // First, check total homes with residents (browse mode)
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
        
        const homeIdsWithResidents = [...new Set(allPeople.map(p => p.homeId))]
        console.log(`Total people: ${allPeople.length}`)
        console.log(`Total homes with residents: ${homeIdsWithResidents.length}`)
        
        // Test first page of browse mode (like Organize page does)
        const pageSize = 50
        const currentPage = 1
        const startIndex = (currentPage - 1) * pageSize
        const endIndex = startIndex + pageSize
        const currentPageHomeIds = homeIdsWithResidents.slice(startIndex, endIndex)
        
        console.log(`\nBrowse mode - Page 1:`)
        console.log(`Should show homes ${startIndex + 1}-${Math.min(endIndex, homeIdsWithResidents.length)} of ${homeIdsWithResidents.length}`)
        console.log(`Current page home IDs: ${currentPageHomeIds.length}`)
        
        // Now test search for "cloverleaf"
        console.log(`\n=== TESTING CLOVERLEAF SEARCH ===`)
        
        let searchResults = []
        let nextToken = null
        let searchCount = 0
        const searchTerm = 'cloverleaf'
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                if (home.street?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    searchResults.push(home)
                }
            }
            
            nextToken = result.nextToken
            searchCount += result.data.length
        } while (nextToken && searchResults.length < 500)
        
        console.log(`Raw search results: ${searchResults.length}`)
        
        // Check for duplicates by ID in raw search
        const searchIds = searchResults.map(h => h.id)
        const uniqueSearchIds = [...new Set(searchIds)]
        console.log(`Unique search IDs: ${uniqueSearchIds.length}`)
        
        if (searchIds.length !== uniqueSearchIds.length) {
            console.log('❌ Raw search has duplicates!')
            const duplicateIds = searchIds.filter((id, index) => searchIds.indexOf(id) !== index)
            console.log(`Duplicate IDs found: ${[...new Set(duplicateIds)].length}`)
        } else {
            console.log('✅ Raw search has no duplicates')
        }
        
        // Apply deduplication
        const uniqueSearchResults = searchResults.filter((home, index, self) => 
            index === self.findIndex(h => h.id === home.id)
        )
        console.log(`After deduplication: ${uniqueSearchResults.length}`)
        
        // Show some examples
        console.log('\nSample search results:')
        uniqueSearchResults.slice(0, 5).forEach((home, i) => {
            const residents = allPeople.filter(p => p.homeId === home.id)
            console.log(`${i + 1}. ${home.street} (ID: ${home.id.substring(0, 8)}...) - ${residents.length} residents`)
        })
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testCurrentState()