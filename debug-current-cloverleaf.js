import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugCurrentCloverleaf() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== DEBUGGING CURRENT CLOVERLEAF STATE ===')
        
        // Get all cloverleaf homes
        let allCloverleafHomes = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                if (home.street?.toLowerCase().includes('cloverleaf')) {
                    allCloverleafHomes.push(home)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Found ${allCloverleafHomes.length} Cloverleaf homes total`)
        
        // Group by address to see duplicates
        const homesByAddress = {}
        
        for (const home of allCloverleafHomes) {
            const address = `${home.street}, ${home.city}`.toLowerCase().trim()
            if (!homesByAddress[address]) {
                homesByAddress[address] = []
            }
            homesByAddress[address].push(home)
        }
        
        const addresses = Object.keys(homesByAddress)
        console.log(`Unique Cloverleaf addresses: ${addresses.length}`)
        
        // Show duplicates
        console.log('\n=== CLOVERLEAF DUPLICATES ===')
        let duplicateCount = 0
        
        for (const addr of addresses) {
            const homes = homesByAddress[addr]
            if (homes.length > 1) {
                duplicateCount += homes.length - 1
                console.log(`${addr}: ${homes.length} copies`)
                homes.forEach((home, i) => {
                    console.log(`  ${i + 1}. ID: ${home.id.substring(0, 8)}... Created: ${home.createdAt}`)
                })
            }
        }
        
        console.log(`\nTotal duplicate Cloverleaf homes to remove: ${duplicateCount}`)
        
        // Check specifically for 42911 Cloverleaf Ct
        const target42911 = homesByAddress['42911 cloverleaf ct, broadlands'] || []
        console.log(`\n=== 42911 CLOVERLEAF CT SPECIFICALLY ===`)
        console.log(`Found ${target42911.length} copies of 42911 Cloverleaf Ct`)
        
        if (target42911.length > 1) {
            console.log('This explains the duplicate rows you see!')
            
            // Get all people to see residents
            let allPeople = []
            let peopleNextToken = null
            
            do {
                const result = await client.models.Person.list({
                    limit: 1000,
                    nextToken: peopleNextToken
                })
                allPeople.push(...result.data)
                peopleNextToken = result.nextToken
            } while (peopleNextToken)
            
            target42911.forEach((home, i) => {
                const residents = allPeople.filter(p => p.homeId === home.id)
                console.log(`\nCopy ${i + 1}: ${home.id.substring(0, 8)}...`)
                console.log(`  Created: ${home.createdAt}`)
                console.log(`  Residents: ${residents.length}`)
                residents.forEach(person => {
                    console.log(`    - ${person.firstName} ${person.lastName} (${person.role})`)
                })
            })
        }
        
        return {
            totalCloverleaf: allCloverleafHomes.length,
            uniqueAddresses: addresses.length,
            duplicateCount,
            homesByAddress
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugCurrentCloverleaf()