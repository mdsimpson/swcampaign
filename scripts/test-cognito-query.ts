// Test querying with Cognito credentials (like the frontend does)
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

Amplify.configure(outputs)

async function main() {
    console.log('Testing query with Cognito credentials (like frontend)...\n')

    const client = generateClient<Schema>()

    try {
        console.log('Querying addresses...')
        const addressesResult = await client.models.Address.list({ limit: 5 })
        console.log(`✅ Found ${addressesResult.data.length} addresses`)

        console.log('\nQuerying residents...')
        const residentsResult = await client.models.Resident.list({ limit: 5 })
        console.log(`✅ Found ${residentsResult.data.length} residents`)

        if (addressesResult.data.length > 0) {
            console.log('\nSample address:')
            const addr = addressesResult.data[0]
            console.log(`  ${addr.street}, ${addr.city}`)
        }

        if (residentsResult.data.length > 0) {
            console.log('\nSample resident:')
            const res = residentsResult.data[0]
            console.log(`  ${res.firstName} ${res.lastName}`)
        }
    } catch (error) {
        console.error('❌ Error querying with Cognito:', error)
        console.error('\nThis means your Cognito user cannot access the data.')
        console.error('Check:')
        console.error('  1. User is in Administrator/Organizer/Canvasser/Member group')
        console.error('  2. Schema authorization has been deployed')
    }
}

main()
