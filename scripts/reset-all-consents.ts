import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>()

async function main() {
    console.log('🔄 Starting consent reset process...\n')

    let deletedConsents = 0
    let updatedResidents = 0
    let errors = 0

    // Step 1: Delete all Consent records
    console.log('📋 Deleting all Consent records...')
    let nextToken: string | null | undefined = null

    do {
        const {data: consents, nextToken: token} = await client.models.Consent.list({
            limit: 100,
            nextToken: nextToken as string | undefined
        })

        for (const consent of consents) {
            try {
                await client.models.Consent.delete({id: consent.id})
                deletedConsents++
                if (deletedConsents % 50 === 0) {
                    console.log(`  Deleted ${deletedConsents} consents...`)
                }
            } catch (err) {
                console.error(`❌ Error deleting consent ${consent.id}:`, err)
                errors++
            }
        }

        nextToken = token
    } while (nextToken)

    console.log(`✅ Deleted ${deletedConsents} consent records\n`)

    // Step 2: Reset all Resident records to hasSigned = false
    console.log('👥 Resetting all Resident records...')
    nextToken = null

    do {
        const {data: residents, nextToken: token} = await client.models.Resident.list({
            limit: 100,
            nextToken: nextToken as string | undefined
        })

        for (const resident of residents) {
            if (resident.hasSigned || resident.signedAt) {
                try {
                    await client.models.Resident.update({
                        id: resident.id,
                        hasSigned: false,
                        signedAt: null as any
                    })
                    updatedResidents++
                    if (updatedResidents % 50 === 0) {
                        console.log(`  Reset ${updatedResidents} residents...`)
                    }
                } catch (err) {
                    console.error(`❌ Error updating resident ${resident.id}:`, err)
                    errors++
                }
            }
        }

        nextToken = token
    } while (nextToken)

    console.log(`✅ Reset ${updatedResidents} resident records\n`)

    // Summary
    console.log('=== Reset Summary ===')
    console.log(`Consents deleted: ${deletedConsents}`)
    console.log(`Residents reset: ${updatedResidents}`)
    console.log(`Errors: ${errors}`)

    if (errors === 0) {
        console.log('\n🎉 All consents successfully reset!')
    } else {
        console.log(`\n⚠️  Completed with ${errors} errors`)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
