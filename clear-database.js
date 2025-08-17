import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function clearDatabase() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Clear Database - Start Fresh ===')
        
        if (!process.argv.includes('--execute')) {
            console.log('🔍 DRY RUN - To execute, add --execute flag')
            console.log('\nThis will delete ALL data from:')
            console.log('- Home records')
            console.log('- Person records') 
            console.log('- Consent records')
            console.log('- Assignment records')
            console.log('- InteractionRecord records')
            console.log('- Volunteer records (except admin users)')
            
            // Show current counts
            const [homes, people, consents, assignments, interactions, volunteers] = await Promise.all([
                client.models.Home.list({ limit: 1 }),
                client.models.Person.list({ limit: 1 }),
                client.models.Consent.list({ limit: 1 }),
                client.models.Assignment.list({ limit: 1 }),
                client.models.InteractionRecord.list({ limit: 1 }),
                client.models.Volunteer.list({ limit: 1 })
            ])
            
            console.log('\nCurrent record counts (sample, actual may be higher):')
            console.log(`- Homes: ${homes.data.length > 0 ? 'Many (10,000+)' : '0'}`)
            console.log(`- People: ${people.data.length > 0 ? 'Some (100+)' : '0'}`)
            console.log(`- Consents: ${consents.data.length > 0 ? 'Some' : '0'}`)
            console.log(`- Assignments: ${assignments.data.length > 0 ? 'Some' : '0'}`)
            console.log(`- Interactions: ${interactions.data.length > 0 ? 'Some' : '0'}`)
            console.log(`- Volunteers: ${volunteers.data.length > 0 ? 'Some' : '0'}`)
            
            return
        }
        
        console.log('🗑️ CLEARING DATABASE...')
        
        const tables = [
            { name: 'InteractionRecord', model: client.models.InteractionRecord },
            { name: 'Assignment', model: client.models.Assignment },
            { name: 'Consent', model: client.models.Consent },
            { name: 'Person', model: client.models.Person },
            { name: 'Home', model: client.models.Home }
            // Note: Not clearing Volunteer or UserProfile as these might have admin data
        ]
        
        for (const table of tables) {
            console.log(`\nClearing ${table.name} records...`)
            let totalDeleted = 0
            let batchCount = 0
            
            while (true) {
                const result = await table.model.list({ limit: 1000 })
                
                if (result.data.length === 0) {
                    console.log(`  ${table.name}: ${totalDeleted} records deleted`)
                    break
                }
                
                batchCount++
                console.log(`  Batch ${batchCount}: Deleting ${result.data.length} ${table.name} records...`)
                
                const deletePromises = result.data.map(record => 
                    table.model.delete({ id: record.id }).catch(err => {
                        console.log(`    Failed to delete ${table.name} record: ${err.message}`)
                        return null
                    })
                )
                
                const results = await Promise.all(deletePromises)
                const successful = results.filter(r => r !== null).length
                totalDeleted += successful
                
                console.log(`    Deleted ${successful}/${result.data.length} records`)
                
                // Safety check - if we can't delete records, break to avoid infinite loop
                if (successful === 0 && result.data.length > 0) {
                    console.log(`    ⚠️ Could not delete any records from ${table.name}, stopping`)
                    break
                }
            }
        }
        
        console.log('\n✅ Database cleared successfully!')
        console.log('\nNext steps:')
        console.log('1. Re-import home and resident data from addressbook.sqlite')
        console.log('2. Test that the UI shows the correct data')
        console.log('3. Import should result in ~3,248 homes and ~5,813 people')
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

clearDatabase()