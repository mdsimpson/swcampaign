import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testFinalFix() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING FINAL ORGANIZE PAGE FIX ===')
        
        const searchTerm = 'cloverleaf'
        console.log(`Searching for: "${searchTerm}"`)
        
        // Replicate the final fixed logic
        let searchResults = []
        let nextToken = null
        let searchCount = 0
        
        // Search through homes without GraphQL filter (do client-side filtering)
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                // Apply search filter
                if (home.street?.toLowerCase().includes(searchTerm.toLowerCase())) {
                    searchResults.push(home)
                }
            }
            
            nextToken = result.nextToken
            searchCount += result.data.length
        } while (nextToken && searchResults.length < 500)
        
        console.log(`Searched ${searchCount} homes, found ${searchResults.length} matches`)
        
        if (searchResults.length > 0) {
            console.log('\n✅ SEARCH IS NOW WORKING!')
            console.log('Found Cloverleaf homes:')
            searchResults.slice(0, 5).forEach(home => {
                console.log(`  - ${home.street}, ${home.city}`)
            })
            
            // Check for Michael Simpson's home specifically
            const simpsonHome = searchResults.find(h => h.street?.includes('42927'))
            if (simpsonHome) {
                console.log(`\n✅ Michael Simpson's home found: ${simpsonHome.street}`)
            }
        } else {
            console.log('\n❌ Still no results')
        }
        
        // Now test loading residents for the first result
        if (searchResults.length > 0) {
            console.log('\n=== TESTING RESIDENT LOADING ===')
            
            // Get ALL people (like the fixed Organize page does)
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
            
            console.log(`Loaded ${allPeople.length} total people`)
            
            // Test residents for first few homes
            for (const home of searchResults.slice(0, 3)) {
                const residents = allPeople.filter(p => p.homeId === home.id)
                console.log(`${home.street}: ${residents.length} residents`)
                residents.forEach(person => {
                    console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
                })
            }
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testFinalFix()