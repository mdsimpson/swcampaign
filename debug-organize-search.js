import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugOrganizeSearch() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== DEBUGGING ORGANIZE PAGE SEARCH ===')
        console.log('Replicating exact Organize page logic...')
        
        const searchTerm = 'cloverleaf'
        console.log(`\nSearching for: "${searchTerm}"`)
        
        // Step 1: Build homeFilter (same as Organize page)
        let homeFilter = {} // { absenteeOwner: { ne: true } } - commented out like in Organize page
        
        if (searchTerm.trim()) {
            homeFilter = {
                and: [
                    homeFilter,
                    {
                        or: [
                            { street: { contains: searchTerm.trim() } },
                            { city: { contains: searchTerm.trim() } }
                        ]
                    }
                ]
            }
        }
        
        console.log('Using homeFilter:', JSON.stringify(homeFilter, null, 2))
        
        // Step 2: Search homes with GraphQL filter (same as Organize page)
        let searchResults = []
        let nextToken = null
        let searchCount = 0
        
        do {
            console.log(`Querying homes with filter, nextToken: ${nextToken}`)
            const result = await client.models.Home.list({
                filter: homeFilter,
                limit: 200,
                nextToken
            })
            
            console.log(`GraphQL returned ${result.data.length} homes`)
            
            for (const home of result.data) {
                // Apply search filter (same as Organize page)
                if (home.street?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    searchResults.push(home)
                    console.log(`  Match found: ${home.street}`)
                }
            }
            
            nextToken = result.nextToken
            searchCount += result.data.length
        } while (nextToken && searchResults.length < 500)
        
        console.log(`\nSearched ${searchCount} homes, found ${searchResults.length} matches`)
        
        if (searchResults.length === 0) {
            console.log('\n❌ NO SEARCH RESULTS FOUND')
            console.log('Let me check if the GraphQL filter is working...')
            
            // Test without the GraphQL filter
            console.log('\n=== TESTING WITHOUT GRAPHQL FILTER ===')
            let allHomesResults = []
            let nextToken2 = null
            let checkedCount = 0
            
            do {
                const result = await client.models.Home.list({
                    limit: 200,
                    nextToken: nextToken2
                })
                
                for (const home of result.data) {
                    checkedCount++
                    if (home.street?.toLowerCase().includes(searchTerm.toLowerCase())) {
                        allHomesResults.push(home)
                        if (allHomesResults.length <= 5) {
                            console.log(`  Direct match found: ${home.street}`)
                        }
                    }
                }
                
                nextToken2 = result.nextToken
            } while (nextToken2 && allHomesResults.length < 20)
            
            console.log(`Without GraphQL filter: checked ${checkedCount} homes, found ${allHomesResults.length} matches`)
            
            if (allHomesResults.length > 0) {
                console.log('\n❌ GraphQL filter is blocking results!')
                console.log('The issue is with the homeFilter GraphQL query')
            }
        } else {
            console.log(`\n✅ Found ${searchResults.length} matches`)
            searchResults.slice(0, 3).forEach(home => {
                console.log(`  - ${home.street}, ${home.city}`)
            })
        }
        
    } catch (error) {
        console.error('Error in debug:', error)
    }
}

debugOrganizeSearch()