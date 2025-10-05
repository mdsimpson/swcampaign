// Check if a resident is marked as signed in production
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

async function getResident(id: string) {
    const query = `
        query GetResident($id: ID!) {
            getResident(id: $id) {
                id
                firstName
                lastName
                hasSigned
                signedAt
                contactEmail
                occupantType
            }
        }
    `
    const data = await graphqlRequest(query, { id })
    return data.getResident
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
    const residentId = process.argv[2]

    if (!residentId) {
        console.error('Usage: npm run check:resident -- <resident_id>')
        process.exit(1)
    }

    console.log(`🔍 Checking resident ${residentId} in production...\n`)

    try {
        const resident = await getResident(residentId)

        if (!resident) {
            console.log(`❌ Resident ${residentId} not found`)
            process.exit(1)
        }

        console.log('=== Resident Information ===')
        console.log(`ID: ${resident.id}`)
        console.log(`Name: ${resident.firstName} ${resident.lastName}`)
        console.log(`Email: ${resident.contactEmail || 'N/A'}`)
        console.log(`Type: ${resident.occupantType || 'N/A'}`)
        console.log(`Has Signed: ${resident.hasSigned ? '✅ YES' : '❌ NO'}`)
        console.log(`Signed At: ${resident.signedAt || 'N/A'}`)

        // Check for consent records
        console.log('\n=== Consent Records ===')
        const consents = await listConsentsByResident(residentId)

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

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
