import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugSearchDuplicates() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== DEBUGGING SEARCH DUPLICATES IN DETAIL ===')
        
        const searchTerm = 'cloverleaf'
        console.log(`Searching for: "${searchTerm}"`)
        
        // Step 1: Get raw search results (exactly like Organize page)
        let searchResults = []
        let nextToken = null
        let searchCount = 0
        
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
        
        // Step 2: Check for duplicates by ID
        const homeIds = searchResults.map(h => h.id)
        const uniqueIds = [...new Set(homeIds)]
        console.log(`Unique home IDs: ${uniqueIds.length}`)
        
        if (homeIds.length !== uniqueIds.length) {
            console.log('❌ Found duplicate home IDs in search results!')
            
            // Find which IDs are duplicated
            const duplicatedIds = homeIds.filter((id, index) => homeIds.indexOf(id) !== index)
            const uniqueDuplicatedIds = [...new Set(duplicatedIds)]
            
            console.log(`Duplicated home IDs: ${uniqueDuplicatedIds.length}`)
            
            for (const duplicatedId of uniqueDuplicatedIds.slice(0, 3)) {
                const duplicates = searchResults.filter(h => h.id === duplicatedId)
                console.log(`\nHome ID ${duplicatedId} appears ${duplicates.length} times:`)
                duplicates.forEach((home, i) => {
                    console.log(`  ${i + 1}. ${home.street} (created: ${home.createdAt})`)
                })
            }
        } else {
            console.log('✅ No duplicate home IDs found in raw search')
        }
        
        // Step 3: Apply deduplication
        const uniqueSearchResults = searchResults.filter((home, index, self) => 
            index === self.findIndex(h => h.id === home.id)
        )
        console.log(`After deduplication: ${uniqueSearchResults.length}`)
        
        // Step 4: Check pagination (first page)
        const pageSize = 50
        const currentPage = 1
        const startIndex = (currentPage - 1) * pageSize
        const endIndex = startIndex + pageSize
        const currentPageHomes = uniqueSearchResults.slice(startIndex, endIndex)
        
        console.log(`Page 1 homes: ${currentPageHomes.length}`)
        
        // Step 5: Get all people and process each home
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
        
        console.log(`Loaded ${allPeople.length} people`)
        
        // Step 6: Process homes with details (like Organize page does)
        const homesWithDetailsPromises = currentPageHomes.map(async (home) => {
            try {
                // Get residents for this home and sort them
                const residents = allPeople
                    .filter(p => p.homeId === home.id)
                    .sort((a, b) => {
                        const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                        const aOrder = roleOrder[a.role] || 5
                        const bOrder = roleOrder[b.role] || 5
                        return aOrder - bOrder
                    })
                
                return { 
                    ...home, 
                    residents,
                    consents: [],
                    assignments: [],
                    consentStatus: 'incomplete'
                }
            } catch (error) {
                console.error(`Error loading home details:`, error)
                return null
            }
        })
        
        const homesWithDetails = (await Promise.all(homesWithDetailsPromises)).filter(home => home !== null)
        
        console.log(`Final homes with details: ${homesWithDetails.length}`)
        
        // Step 7: Check final results for duplicates
        const finalIds = homesWithDetails.map(h => h.id)
        const finalUniqueIds = [...new Set(finalIds)]
        
        if (finalIds.length !== finalUniqueIds.length) {
            console.log('❌ Still have duplicates in final results!')
        } else {
            console.log('✅ No duplicates in final results')
        }
        
        // Step 8: Show some results
        console.log('\n=== FINAL RESULTS SAMPLE ===')
        homesWithDetails.slice(0, 5).forEach(home => {
            console.log(`${home.street}: ${home.residents.length} residents`)
            home.residents.forEach(r => {
                console.log(`  - ${r.firstName} ${r.lastName} (${r.role})`)
            })
        })
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugSearchDuplicates()