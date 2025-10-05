// Check resident by externalId using correct production endpoint
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://bwng3ppgdfhl5cnfzv3difc4vm.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ngrxku5bhzezhih2pxgitb6mtq"

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
                    address {
                        street
                    }
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { externalId: { eq: externalId } }
    })
    return data.listResidents.items
}

async function main() {
    const externalId = process.argv[2] || "1940"

    console.log(`🔍 Checking resident with externalId ${externalId} in production (CORRECT endpoint)...\n`)

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
            console.log(`Address: ${resident.address?.street || 'N/A'}`)
            console.log(`Email: ${resident.contactEmail || 'N/A'}`)
            console.log(`Type: ${resident.occupantType || 'N/A'}`)
            console.log(`Has Signed: ${resident.hasSigned ? '✅ YES' : '❌ NO'}`)
            console.log(`Signed At: ${resident.signedAt || 'N/A'}`)
        }

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
