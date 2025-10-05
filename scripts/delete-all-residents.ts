import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'
import outputs from '../amplify_outputs.json'

// Configure Amplify
Amplify.configure(outputs)

const client = generateClient<Schema>({
    authMode: 'apiKey'
})

async function main() {
    console.log('Starting deletion of all residents from production database...')
    
    let totalDeleted = 0
    let totalErrors = 0
    let nextToken: string | null = null
    
    do {
        try {
            // Get a batch of residents
            const result = await client.models.Resident.list({
                limit: 100,
                nextToken: nextToken || undefined
            })
            
            if (!result.data || result.data.length === 0) {
                console.log('No more residents found.')
                break
            }
            
            console.log(`Found ${result.data.length} residents to delete...`)
            
            // Delete each resident
            for (const resident of result.data) {
                try {
                    const deleteResult = await client.models.Resident.delete({
                        id: resident.id
                    })
                    
                    if (deleteResult.data) {
                        totalDeleted++
                        console.log(`✓ Deleted resident ${resident.firstName} ${resident.lastName} (ID: ${resident.id})`)
                    } else {
                        totalErrors++
                        console.error(`✗ Failed to delete ${resident.firstName} ${resident.lastName} (ID: ${resident.id})`)
                        if (deleteResult.errors) {
                            console.error('Errors:', deleteResult.errors)
                        }
                    }
                } catch (error) {
                    totalErrors++
                    console.error(`✗ Error deleting ${resident.firstName} ${resident.lastName} (ID: ${resident.id}):`, error)
                }
                
                // Small delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 50))
            }
            
            nextToken = result.nextToken
            
        } catch (error) {
            console.error('Error fetching residents:', error)
            break
        }
        
    } while (nextToken)
    
    console.log('\n=== DELETION COMPLETE ===')
    console.log(`✓ Successfully deleted: ${totalDeleted} residents`)
    console.log(`✗ Errors: ${totalErrors} residents`)
    
    if (totalDeleted > 0) {
        console.log('\nAll residents have been deleted from the production database.')
        console.log('You can now verify in the AWS console before reimporting.')
    }
}

main().catch(console.error)