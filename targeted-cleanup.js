import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function targetedCleanup() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Targeted Cleanup: Remove Duplicates, Keep Homes with Residents ===')
        
        // Get all people first (these point to the "good" homes)
        const peopleResult = await client.models.Person.list()
        const homeIdsWithResidents = new Set(peopleResult.data.map(p => p.homeId))
        
        console.log(`People in database: ${peopleResult.data.length}`)
        console.log(`Unique home IDs with residents: ${homeIdsWithResidents.size}`)
        console.log(`Expected: ~5,813 people across ~3,248 homes`)
        console.log(`This suggests we need to import the remaining ~${5813 - peopleResult.data.length} people`)
        
        if (!process.argv.includes('--execute')) {
            console.log('\n🔍 DRY RUN - To execute cleanup, add --execute flag')
            console.log('\nThis cleanup will:')
            console.log(`1. Keep ${homeIdsWithResidents.size} homes that have residents`)
            console.log('2. Delete all other home records (likely 9,900+ duplicates)')
            console.log('3. Preserve all person records')
            
            // Sample the homes with residents
            console.log('\nSample of homes that will be KEPT (have residents):')
            let sampleCount = 0
            for (const homeId of homeIdsWithResidents) {
                if (sampleCount >= 5) break
                try {
                    const homeResult = await client.models.Home.get({ id: homeId })
                    if (homeResult.data) {
                        const residents = peopleResult.data.filter(p => p.homeId === homeId)
                        console.log(`  ${homeResult.data.street}: ${residents.length} residents`)
                        residents.forEach(r => console.log(`    - ${r.firstName} ${r.lastName}`))
                    }
                    sampleCount++
                } catch (error) {
                    console.log(`  Error fetching home ${homeId}`)
                }
            }
            
            console.log('\nAfter cleanup, you can re-import the remaining homes and residents from addressbook.sqlite')
            
        } else {
            console.log('\n🗑️ EXECUTING CLEANUP...')
            console.log('This will delete ALL homes except those with residents')
            
            let totalDeleted = 0
            let batchSize = 100
            let processed = 0
            
            while (true) {
                // Fetch a batch of homes
                const homesResult = await client.models.Home.list({ limit: batchSize })
                
                if (homesResult.data.length === 0) {
                    break // No more homes
                }
                
                const toDelete = homesResult.data.filter(home => !homeIdsWithResidents.has(home.id))
                
                console.log(`Batch: ${homesResult.data.length} homes, ${toDelete.length} to delete`)
                
                // Delete homes without residents
                const deletePromises = toDelete.map(home => 
                    client.models.Home.delete({ id: home.id }).catch(err => {
                        console.log(`Failed to delete ${home.street}: ${err.message}`)
                        return null
                    })
                )
                
                const results = await Promise.all(deletePromises)
                const successful = results.filter(r => r !== null).length
                
                totalDeleted += successful
                processed += homesResult.data.length
                
                console.log(`Deleted ${successful}/${toDelete.length} homes. Total deleted: ${totalDeleted}`)
                
                // If this batch was smaller than batchSize, we're done
                if (homesResult.data.length < batchSize) {
                    break
                }
            }
            
            console.log(`\n✅ Cleanup complete!`)
            console.log(`Total homes deleted: ${totalDeleted}`)
            
            // Verify
            const remainingHomes = await client.models.Home.list()
            console.log(`Remaining homes: ${remainingHomes.data.length}`)
            console.log(`Expected to match homes with residents: ${homeIdsWithResidents.size}`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

targetedCleanup()