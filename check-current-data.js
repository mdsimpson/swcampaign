import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function checkCurrentData() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== CHECKING CURRENT DATABASE STATE ===')
        
        // Get total people count
        let totalPeople = 0
        let peopleNextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken: peopleNextToken
            })
            totalPeople += result.data.length
            peopleNextToken = result.nextToken
            console.log(`Loaded ${result.data.length} people (batch), total so far: ${totalPeople}`)
        } while (peopleNextToken)
        
        console.log(`\nTotal people in database: ${totalPeople}`)
        
        // Get total homes count
        let totalHomes = 0
        let homesNextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 1000,
                nextToken: homesNextToken
            })
            totalHomes += result.data.length
            homesNextToken = result.nextToken
        } while (homesNextToken)
        
        console.log(`Total homes in database: ${totalHomes}`)
        
        // Now test with ALL people for Cloverleaf search
        console.log('\n=== TESTING CLOVERLEAF SEARCH WITH ALL PEOPLE ===')
        
        // Get ALL people
        let allPeople = []
        let nextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken
            })
            allPeople.push(...result.data)
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Retrieved all ${allPeople.length} people`)
        
        // Search for Cloverleaf homes
        const cloverleafHomes = []
        let homeNextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken: homeNextToken
            })
            
            for (const home of result.data) {
                if (home.street?.toLowerCase().includes('cloverleaf')) {
                    cloverleafHomes.push(home)
                }
            }
            
            homeNextToken = result.nextToken
        } while (homeNextToken && cloverleafHomes.length < 20)
        
        console.log(`Found ${cloverleafHomes.length} Cloverleaf homes`)
        
        // For each Cloverleaf home, find residents
        for (const home of cloverleafHomes.slice(0, 5)) {
            const residents = allPeople.filter(p => p.homeId === home.id)
            console.log(`${home.street}: ${residents.length} residents`)
            if (residents.length > 0) {
                residents.forEach(person => {
                    console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
                })
            }
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

checkCurrentData()