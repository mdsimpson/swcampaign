import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function accurateCount() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== ACCURATE COUNT CHECK ===')
        
        // Method 1: Count with small batches to be sure
        console.log('Counting homes...')
        let homeCount = 0
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 100, // Smaller batch
                nextToken
            })
            homeCount += result.data.length
            nextToken = result.nextToken
            
            if (homeCount % 1000 === 0) {
                console.log(`  Homes so far: ${homeCount}`)
            }
        } while (nextToken)
        
        console.log(`Total Homes: ${homeCount}`)
        
        // Count people
        console.log('\nCounting people...')
        let peopleCount = 0
        nextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 100, // Smaller batch
                nextToken
            })
            peopleCount += result.data.length
            nextToken = result.nextToken
            
            if (peopleCount % 1000 === 0) {
                console.log(`  People so far: ${peopleCount}`)
            }
        } while (nextToken)
        
        console.log(`Total People: ${peopleCount}`)
        
        // Check for duplicates by address
        console.log('\n=== CHECKING FOR DUPLICATE ADDRESSES ===')
        const homeAddresses = new Set()
        let duplicateCount = 0
        nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 100,
                nextToken
            })
            
            for (const home of result.data) {
                const address = `${home.street}|${home.city}|${home.state || 'VA'}`
                if (homeAddresses.has(address)) {
                    duplicateCount++
                    if (duplicateCount <= 5) {
                        console.log(`Duplicate: ${home.street}, ${home.city}`)
                    }
                } else {
                    homeAddresses.add(address)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Unique addresses: ${homeAddresses.size}`)
        console.log(`Duplicate addresses: ${duplicateCount}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

accurateCount()