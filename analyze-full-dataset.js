import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function analyzeFullDataset() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Analyzing Full Dataset ===')
        console.log('This may take a while...')
        
        // Get ALL homes with pagination
        let allHomes = []
        let nextToken = null
        let pageCount = 0
        
        console.log('Fetching all homes...')
        do {
            const result = await client.models.Home.list({
                nextToken: nextToken,
                limit: 1000
            })
            
            allHomes = allHomes.concat(result.data)
            nextToken = result.nextToken
            pageCount++
            
            if (pageCount % 5 === 0 || !nextToken) {
                console.log(`  Fetched ${allHomes.length} homes so far...`)
            }
            
        } while (nextToken && pageCount < 20) // Safety limit
        
        console.log(`\nTotal homes in database: ${allHomes.length}`)
        
        // Analyze duplicates
        const addressCounts = new Map()
        allHomes.forEach(home => {
            const key = `${home.street}|${home.city}|${home.state}`
            if (!addressCounts.has(key)) {
                addressCounts.set(key, { count: 0, ids: [] })
            }
            const entry = addressCounts.get(key)
            entry.count++
            entry.ids.push(home.id)
        })
        
        const duplicates = Array.from(addressCounts.entries())
            .filter(([addr, data]) => data.count > 1)
            .sort((a, b) => b[1].count - a[1].count)
        
        console.log(`\nUnique addresses: ${addressCounts.size}`)
        console.log(`Addresses with duplicates: ${duplicates.length}`)
        
        if (duplicates.length > 0) {
            console.log(`\nTop 10 most duplicated addresses:`)
            duplicates.slice(0, 10).forEach(([addr, data], i) => {
                const [street, city, state] = addr.split('|')
                console.log(`${i+1}. ${street}, ${city} ${state}: ${data.count} copies`)
            })
            
            // Check how many duplicates the homes with residents have
            const peopleResult = await client.models.Person.list()
            const homeIdsWithResidents = new Set(peopleResult.data.map(p => p.homeId))
            
            console.log(`\n--- Analyzing homes with residents ---`)
            let residentsInDuplicates = 0
            let residentsWithSingleCopy = 0
            
            for (const [addr, data] of duplicates) {
                const hasResidents = data.ids.some(id => homeIdsWithResidents.has(id))
                if (hasResidents) {
                    residentsInDuplicates++
                }
            }
            
            console.log(`Unique addresses that have residents AND duplicates: ${residentsInDuplicates}`)
            
            // Show what needs to be cleaned up
            const maxDuplicateCount = Math.max(...duplicates.map(([_, data]) => data.count))
            const totalHomesToDelete = allHomes.length - addressCounts.size
            
            console.log(`\n--- Cleanup Analysis ---`)
            console.log(`Total homes: ${allHomes.length}`)
            console.log(`Unique addresses: ${addressCounts.size}`)
            console.log(`Homes to delete: ${totalHomesToDelete}`)
            console.log(`Max duplicates for single address: ${maxDuplicateCount}`)
            
            // Estimate which homes to keep (those with residents should be prioritized)
            console.log(`\nStrategy: Keep one copy of each address, prioritizing those with residents`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

analyzeFullDataset()