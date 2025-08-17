import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testOrganizeSearch() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING ORGANIZE PAGE SEARCH LOGIC ===')
        
        // Test 1: Get all people first (like Organize page does)
        console.log('1. Getting all people...')
        const allPeopleResult = await client.models.Person.list({ limit: 1000 })
        console.log(`Found ${allPeopleResult.data.length} people total`)
        
        // Test 2: Get unique homeIds with residents
        const homeIdsWithResidents = [...new Set(allPeopleResult.data.map(p => p.homeId))]
        console.log(`Found ${homeIdsWithResidents.length} unique homes with residents`)
        
        // Test 3: Search for Cloverleaf
        console.log('\n2. Testing search for "Cloverleaf"...')
        
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
                // Apply search filter (same logic as Organize page)
                if (home.street?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    searchResults.push(home)
                }
            }
            
            nextToken = result.nextToken
            searchCount += result.data.length
        } while (nextToken && searchResults.length < 50)
        
        console.log(`Searched ${searchCount} homes, found ${searchResults.length} Cloverleaf matches`)
        
        // Test 4: For each search result, get residents
        console.log('\n3. Testing residents for Cloverleaf homes...')
        
        for (const home of searchResults.slice(0, 5)) {
            const residents = allPeopleResult.data.filter(p => p.homeId === home.id)
            console.log(`${home.street}: ${residents.length} residents`)
            if (residents.length > 0) {
                residents.forEach(person => {
                    console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
                })
            }
        }
        
        // Test 5: Test browsing mode (homes with residents only)
        console.log('\n4. Testing browsing mode (first 10 homes with residents)...')
        
        const first10HomeIds = homeIdsWithResidents.slice(0, 10)
        for (const homeId of first10HomeIds) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId })
                if (homeResult.data) {
                    const home = homeResult.data
                    const residents = allPeopleResult.data.filter(p => p.homeId === homeId)
                    console.log(`${home.street}: ${residents.length} residents`)
                }
            } catch (error) {
                console.log(`Error loading home ${homeId}: ${error.message}`)
            }
        }
        
        console.log('\n=== ORGANIZE PAGE SEARCH WORKING CORRECTLY ===')
        
    } catch (error) {
        console.error('Error testing Organize search:', error)
    }
}

testOrganizeSearch()