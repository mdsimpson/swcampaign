// Count database items using Cognito auth (same as web pages)
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

Amplify.configure(outputs)

async function main() {
    console.log('🔍 Counting items using Cognito auth (same as web pages)...\n')

    const client = generateClient<Schema>()

    try {
        // Count residents
        let residentCount = 0
        let residentsToken = null
        do {
            const result = await client.models.Resident.list({ limit: 1000, nextToken: residentsToken })
            residentCount += result.data.length
            residentsToken = result.nextToken
            if (residentsToken) {
                console.log(`  Counted ${residentCount} residents so far...`)
            }
        } while (residentsToken)

        // Count addresses
        let addressCount = 0
        let addressesToken = null
        do {
            const result = await client.models.Address.list({ limit: 1000, nextToken: addressesToken })
            addressCount += result.data.length
            addressesToken = result.nextToken
            if (addressesToken) {
                console.log(`  Counted ${addressCount} addresses so far...`)
            }
        } while (addressesToken)

        console.log('\n' + '='.repeat(60))
        console.log('📊 Database Stats (Cognito Auth):')
        console.log('='.repeat(60))
        console.log(`Residents: ${residentCount}`)
        console.log(`Addresses: ${addressCount}`)
        console.log('')

        // Show first 5 residents
        console.log('Sample residents:')
        const sample = await client.models.Resident.list({ limit: 5 })
        sample.data.forEach(r => {
            console.log(`  - ${r.firstName} ${r.lastName} (externalId: ${r.externalId || 'N/A'})`)
        })

    } catch (error: any) {
        console.error('❌ Error:', error.message || error)
        console.error('\nMake sure you are logged in to the app first!')
    }
}

main()
