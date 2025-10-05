// Check resident by externalId in production
import fetch from 'node-fetch'

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

async function findResidentByExternalId(externalId: string) {
    const query = `
        query ListResidents($filter: ModelResidentFilterInput) {
            listResidents(filter: $filter) {
                items {
                    id
                    externalId
                    firstName
                    lastName
                    hasSigned
                    signedAt
                    contactEmail
                    occupantType
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { externalId: { eq: externalId } }
    })
    return data.listResidents.items
}

async function listConsentsByResident(residentId: string) {
    const query = `
        query ListConsents($filter: ModelConsentFilterInput) {
            listConsents(filter: $filter) {
                items {
                    id
                    residentId
                    recordedAt
                    recordedBy
                    source
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { residentId: { eq: residentId } }
    })
    return data.listConsents.items
}

async function main() {
    const externalId = process.argv[2]

    if (!externalId) {
        console.error('Usage: npm run check:resident:external -- <external_id>')
        process.exit(1)
    }

    console.log(`🔍 Checking resident with externalId ${externalId} in production...\n`)

    try {
        const residents = await findResidentByExternalId(externalId)

        if (residents.length === 0) {
            console.log(`❌ No resident found with externalId ${externalId}`)
            process.exit(1)
        }

        for (const resident of residents) {
            console.log('=== Resident Information ===')
            console.log(`Database ID: ${resident.id}`)
            console.log(`External ID: ${resident.externalId}`)
            console.log(`Name: ${resident.firstName} ${resident.lastName}`)
            console.log(`Email: ${resident.contactEmail || 'N/A'}`)
            console.log(`Type: ${resident.occupantType || 'N/A'}`)
            console.log(`Has Signed: ${resident.hasSigned ? '✅ YES' : '❌ NO'}`)
            console.log(`Signed At: ${resident.signedAt || 'N/A'}`)

            // Check for consent records
            console.log('\n=== Consent Records ===')
            const consents = await listConsentsByResident(resident.id)

            if (consents.length === 0) {
                console.log('No consent records found')
            } else {
                console.log(`Found ${consents.length} consent record(s):`)
                consents.forEach((consent, idx) => {
                    console.log(`\n  Consent ${idx + 1}:`)
                    console.log(`    ID: ${consent.id}`)
                    console.log(`    Recorded At: ${consent.recordedAt}`)
                    console.log(`    Recorded By: ${consent.recordedBy || 'N/A'}`)
                    console.log(`    Source: ${consent.source || 'N/A'}`)
                })
            }

            if (residents.length > 1) {
                console.log('\n' + '='.repeat(50) + '\n')
            }
        }

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
