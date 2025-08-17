import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testDuplicateFix() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING DUPLICATE REMOVAL AND RESIDENT SORTING ===')
        
        const searchTerm = 'cloverleaf'
        console.log(`Searching for: "${searchTerm}"`)
        
        // Replicate the fixed search logic
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
        
        console.log(`Initial search found ${searchResults.length} matches`)
        
        // Remove duplicates (new logic)
        const uniqueSearchResults = searchResults.filter((home, index, self) => 
            index === self.findIndex(h => h.id === home.id)
        )
        console.log(`After removing duplicates: ${uniqueSearchResults.length} unique homes`)
        
        // Get all people
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
        
        // Test the first few homes with residents sorted properly
        console.log('\n=== TESTING RESIDENT SORTING ===')
        
        for (const home of uniqueSearchResults.slice(0, 5)) {
            // Apply the new sorting logic
            const residents = allPeople
                .filter(p => p.homeId === home.id)
                .sort((a, b) => {
                    const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                    const aOrder = roleOrder[a.role] || 5
                    const bOrder = roleOrder[b.role] || 5
                    return aOrder - bOrder
                })
            
            console.log(`\n${home.street}: ${residents.length} residents`)
            residents.forEach((person, i) => {
                const marker = i === 0 ? '👑' : '  '
                console.log(`${marker} ${person.firstName} ${person.lastName} (${person.role})`)
            })
        }
        
        // Check specifically for Michael Simpson's home to verify correct sorting
        const simpsonHome = uniqueSearchResults.find(h => h.street?.includes('42927'))
        if (simpsonHome) {
            const simpsonResidents = allPeople
                .filter(p => p.homeId === simpsonHome.id)
                .sort((a, b) => {
                    const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                    const aOrder = roleOrder[a.role] || 5
                    const bOrder = roleOrder[b.role] || 5
                    return aOrder - bOrder
                })
            
            console.log(`\n✅ Michael Simpson's home verification:`)
            console.log(`${simpsonHome.street}:`)
            simpsonResidents.forEach((person, i) => {
                const marker = i === 0 ? '👑 PRIMARY' : '   SECONDARY'
                console.log(`${marker}: ${person.firstName} ${person.lastName} (${person.role})`)
            })
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testDuplicateFix()