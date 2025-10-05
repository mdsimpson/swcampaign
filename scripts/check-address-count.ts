// Check actual address count in database
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>({
    authMode: 'apiKey'
})

async function main() {
    try {
        console.log('Checking actual address count in database...')
        
        // Load ALL addresses
        let allAddresses = []
        let nextToken = null
        
        do {
            const addressesQuery = await client.models.Address.list({
                limit: 1000,
                nextToken: nextToken
            })
            allAddresses.push(...addressesQuery.data)
            nextToken = addressesQuery.nextToken
            console.log(`Loaded ${allAddresses.length} addresses so far...`)
        } while (nextToken)
        
        console.log(`\nTotal addresses in database: ${allAddresses.length}`)
        
        // Check for duplicates using the same logic as the home page
        const addressMap = new Map()
        allAddresses.forEach(address => {
            const addressKey = `${address.street}, ${address.city}`.toLowerCase()
            if (addressMap.has(addressKey)) {
                addressMap.set(addressKey, addressMap.get(addressKey) + 1)
            } else {
                addressMap.set(addressKey, 1)
            }
        })
        
        const duplicates = Array.from(addressMap.entries()).filter(([address, count]) => count > 1)
        const uniqueAddresses = addressMap.size
        
        console.log(`Unique addresses (as calculated by home page): ${uniqueAddresses}`)
        console.log(`Duplicate address groups: ${duplicates.length}`)
        
        if (duplicates.length > 0) {
            console.log(`\nFirst few duplicates:`)
            duplicates.slice(0, 5).forEach(([address, count]) => {
                console.log(`  "${address}" appears ${count} times`)
            })
        }
        
        // Also check what we expect from CSV
        console.log(`\nExpected from address2.csv: 1112 addresses`)
        console.log(`Difference: ${allAddresses.length - 1112}`)
        
    } catch (error) {
        console.error('Error checking addresses:', error)
    }
}

main()