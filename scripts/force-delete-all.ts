// Force delete ALL data from sandbox - more thorough approach
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>({
    authMode: 'apiKey'
})

async function deleteAllOfType<T>(
    modelName: string, 
    listFn: () => Promise<any>,
    deleteFn: (id: string) => Promise<any>
) {
    console.log(`Deleting all ${modelName}...`)
    let totalDeleted = 0
    let batchCount = 0
    
    while (true) {
        const result = await listFn()
        const items = result.data
        
        if (items.length === 0) {
            break
        }
        
        console.log(`  Batch ${++batchCount}: Deleting ${items.length} ${modelName}...`)
        
        // Delete in smaller batches to avoid timeouts
        const batchSize = 50
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize)
            await Promise.all(batch.map(item => deleteFn(item.id)))
            totalDeleted += batch.length
            
            if (batch.length === batchSize) {
                console.log(`    Deleted ${totalDeleted} ${modelName} so far...`)
            }
        }
    }
    
    console.log(`  Total ${modelName} deleted: ${totalDeleted}`)
    return totalDeleted
}

async function main() {
    try {
        console.log('=== FORCE DELETING ALL DATA ===\n')
        
        // Delete in proper order (foreign key dependencies)
        await deleteAllOfType(
            'Assignments',
            () => client.models.Assignment.list({ limit: 1000 }),
            (id) => client.models.Assignment.delete({ id })
        )
        
        await deleteAllOfType(
            'InteractionRecords',
            () => client.models.InteractionRecord.list({ limit: 1000 }),
            (id) => client.models.InteractionRecord.delete({ id })
        )
        
        await deleteAllOfType(
            'Consents',
            () => client.models.Consent.list({ limit: 1000 }),
            (id) => client.models.Consent.delete({ id })
        )
        
        await deleteAllOfType(
            'Residents',
            () => client.models.Resident.list({ limit: 1000 }),
            (id) => client.models.Resident.delete({ id })
        )
        
        await deleteAllOfType(
            'Addresses',
            () => client.models.Address.list({ limit: 1000 }),
            (id) => client.models.Address.delete({ id })
        )
        
        console.log('\n=== ALL DATA FORCE DELETED ===')
        
        // Verify counts
        console.log('\nVerifying deletion...')
        const [addresses, residents, assignments, interactions, consents] = await Promise.all([
            client.models.Address.list({ limit: 10 }),
            client.models.Resident.list({ limit: 10 }),
            client.models.Assignment.list({ limit: 10 }),
            client.models.InteractionRecord.list({ limit: 10 }),
            client.models.Consent.list({ limit: 10 })
        ])
        
        console.log(`Remaining addresses: ${addresses.data.length}`)
        console.log(`Remaining residents: ${residents.data.length}`)
        console.log(`Remaining assignments: ${assignments.data.length}`)
        console.log(`Remaining interactions: ${interactions.data.length}`)
        console.log(`Remaining consents: ${consents.data.length}`)
        
    } catch (error) {
        console.error('Error during deletion:', error)
        process.exit(1)
    }
}

main()