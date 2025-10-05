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
    try {
        console.log('Checking residents count in production database...')
        
        const result = await client.models.Resident.list({
            limit: 5
        })
        
        if (result.errors) {
            console.error('Errors:', result.errors)
            return
        }
        
        console.log(`Found ${result.data?.length || 0} residents in the first batch`)
        
        if (result.data && result.data.length > 0) {
            console.log('Sample residents:')
            result.data.forEach(resident => {
                console.log(`- ${resident.firstName} ${resident.lastName} (ID: ${resident.id})`)
            })
        } else {
            console.log('No residents found in the database.')
        }
        
    } catch (error) {
        console.error('Error checking residents:', error)
    }
}

main().catch(console.error)