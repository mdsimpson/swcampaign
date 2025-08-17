import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function analyzeDuplicates() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== ANALYZING DATABASE DUPLICATES ===')
        
        // Get all homes
        let allHomes = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 1000,
                nextToken
            })
            allHomes.push(...result.data)
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Total homes in database: ${allHomes.length}`)
        
        // Group by address to find duplicates
        const homesByAddress = {}
        
        for (const home of allHomes) {
            const address = `${home.street}, ${home.city}`.toLowerCase().trim()
            if (!homesByAddress[address]) {
                homesByAddress[address] = []
            }
            homesByAddress[address].push(home)
        }
        
        const addresses = Object.keys(homesByAddress)
        console.log(`Unique addresses: ${addresses.length}`)
        
        // Find duplicates
        const duplicatedAddresses = addresses.filter(addr => homesByAddress[addr].length > 1)
        console.log(`Addresses with duplicates: ${duplicatedAddresses.length}`)
        
        let totalDuplicateHomes = 0
        
        console.log('\nTop 10 duplicated addresses:')
        for (const addr of duplicatedAddresses.slice(0, 10)) {
            const homes = homesByAddress[addr]
            totalDuplicateHomes += homes.length - 1 // count extras
            console.log(`${addr}: ${homes.length} copies`)
            
            // Show creation dates to see when duplicates were created
            homes.forEach((home, i) => {
                console.log(`  ${i + 1}. ID: ${home.id.substring(0, 8)}... Created: ${home.createdAt}`)
            })
        }
        
        console.log(`\nTotal duplicate homes to remove: ${totalDuplicateHomes}`)
        console.log(`Expected final count: ${allHomes.length - totalDuplicateHomes}`)
        
        // Check people count too
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
        
        console.log(`\nTotal people in database: ${allPeople.length}`)
        console.log(`Expected people count: ~5,820`)
        
        // Check if we have exactly double everything
        const expectedHomes = 3248
        const expectedPeople = 5820
        
        if (Math.abs(allHomes.length - expectedHomes * 2) < 100) {
            console.log('\n🚨 DETECTED: Database has roughly 2x the expected data!')
            console.log('This confirms we imported data twice.')
        }
        
        return {
            totalHomes: allHomes.length,
            uniqueAddresses: addresses.length,
            duplicatedAddresses: duplicatedAddresses.length,
            homesByAddress,
            allHomes,
            allPeople
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

analyzeDuplicates()