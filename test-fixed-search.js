import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testFixedSearch() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING FIXED SEARCH LOGIC ===')
        
        const searchTerm = 'cloverleaf'
        console.log(`Searching for: "${searchTerm}"`)
        
        // Fixed filter logic
        let homeFilter = undefined
        
        if (searchTerm.trim()) {
            homeFilter = {
                or: [
                    { street: { contains: searchTerm.trim() } },
                    { city: { contains: searchTerm.trim() } }
                ]
            }
        }
        
        console.log('Using fixed homeFilter:', JSON.stringify(homeFilter, null, 2))
        
        // Test the GraphQL query
        let searchResults = []
        let nextToken = null
        let searchCount = 0
        
        do {
            const result = await client.models.Home.list({
                filter: homeFilter,
                limit: 200,
                nextToken
            })
            
            console.log(`GraphQL returned ${result.data.length} homes`)
            
            for (const home of result.data) {
                // Apply search filter
                if (home.street?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    searchResults.push(home)
                    if (searchResults.length <= 5) {
                        console.log(`  Match: ${home.street}, ${home.city}`)
                    }
                }
            }
            
            nextToken = result.nextToken
            searchCount += result.data.length
        } while (nextToken && searchResults.length < 500)
        
        console.log(`\nFixed search: Found ${searchResults.length} matches from ${searchCount} homes`)
        
        if (searchResults.length > 0) {
            console.log('\n✅ SEARCH IS NOW WORKING!')
            
            // Test specific Michael Simpson address
            const simpsonHome = searchResults.find(h => h.street?.includes('42927'))
            if (simpsonHome) {
                console.log(`\n✅ Found Michael Simpson's home: ${simpsonHome.street}`)
            }
        } else {
            console.log('\n❌ Still no results')
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testFixedSearch()