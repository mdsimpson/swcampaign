// Reset all consent signatures in production using direct GraphQL
import fetch from 'node-fetch'

// Production configuration
const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ilcaatyuoffcrjo73iy2rk4hxy"

async function graphqlRequest(query: string, variables: any = {}) {
    const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({ query, variables })
    })

    const result = await response.json()
    if (result.errors) {
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function listAllConsents() {
    const query = `
        query ListConsents($nextToken: String) {
            listConsents(limit: 100, nextToken: $nextToken) {
                items {
                    id
                }
                nextToken
            }
        }
    `

    const allConsents: any[] = []
    let nextToken: string | null = null

    do {
        const data = await graphqlRequest(query, { nextToken })
        allConsents.push(...data.listConsents.items)
        nextToken = data.listConsents.nextToken
    } while (nextToken)

    return allConsents
}

async function deleteConsent(id: string) {
    const mutation = `
        mutation DeleteConsent($input: DeleteConsentInput!) {
            deleteConsent(input: $input) {
                id
            }
        }
    `
    await graphqlRequest(mutation, { input: { id } })
}

async function listAllResidents() {
    const query = `
        query ListResidents($nextToken: String) {
            listResidents(limit: 100, nextToken: $nextToken) {
                items {
                    id
                    hasSigned
                    signedAt
                    firstName
                    lastName
                }
                nextToken
            }
        }
    `

    const allResidents: any[] = []
    let nextToken: string | null = null

    do {
        const data = await graphqlRequest(query, { nextToken })
        allResidents.push(...data.listResidents.items)
        nextToken = data.listResidents.nextToken
    } while (nextToken)

    return allResidents
}

async function resetResident(id: string) {
    const mutation = `
        mutation UpdateResident($input: UpdateResidentInput!) {
            updateResident(input: $input) {
                id
                hasSigned
                signedAt
            }
        }
    `
    await graphqlRequest(mutation, {
        input: {
            id,
            hasSigned: false,
            signedAt: null
        }
    })
}

async function main() {
    console.log('🚀 Starting production consent reset...')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    console.log('\n⚠️  WARNING: This will delete ALL consent records and reset ALL residents!')
    console.log('Press Ctrl+C within 5 seconds to cancel...\n')

    // Wait 5 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 5000))

    let deletedConsents = 0
    let updatedResidents = 0
    let errors = 0

    // Step 1: Delete all Consent records
    console.log('📋 Fetching all Consent records...')
    const consents = await listAllConsents()
    console.log(`Found ${consents.length} consents to delete\n`)

    console.log('🗑️  Deleting consent records...')
    for (const consent of consents) {
        try {
            await deleteConsent(consent.id)
            deletedConsents++
            if (deletedConsents % 50 === 0) {
                console.log(`  Deleted ${deletedConsents}/${consents.length} consents...`)
            }
        } catch (err) {
            console.error(`❌ Error deleting consent ${consent.id}:`, err)
            errors++
        }
    }

    console.log(`✅ Deleted ${deletedConsents} consent records\n`)

    // Step 2: Reset all Resident records
    console.log('👥 Fetching all Resident records...')
    const residents = await listAllResidents()
    const residentsToReset = residents.filter(r => r.hasSigned || r.signedAt)
    console.log(`Found ${residentsToReset.length} residents to reset (out of ${residents.length} total)\n`)

    console.log('🔄 Resetting resident records...')
    for (const resident of residentsToReset) {
        try {
            await resetResident(resident.id)
            updatedResidents++
            if (updatedResidents % 50 === 0) {
                console.log(`  Reset ${updatedResidents}/${residentsToReset.length} residents...`)
            }
        } catch (err) {
            console.error(`❌ Error resetting resident ${resident.id} (${resident.firstName} ${resident.lastName}):`, err)
            errors++
        }
    }

    console.log(`✅ Reset ${updatedResidents} resident records\n`)

    // Summary
    console.log('=== Production Reset Summary ===')
    console.log(`Consents deleted: ${deletedConsents}`)
    console.log(`Residents reset: ${updatedResidents}`)
    console.log(`Errors: ${errors}`)

    if (errors === 0) {
        console.log('\n🎉 All consents successfully reset in production!')
    } else {
        console.log(`\n⚠️  Completed with ${errors} errors`)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
