// Find resident by externalId
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://bwng3ppgdfhl5cnfzv3difc4vm.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-mgxvgdjuffbvpcz4gljvulnw4m"

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
        console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2))
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function main() {
    const externalId = process.argv[2] || '7'
    console.log(`🔍 Searching for resident with externalId: ${externalId}\n`)

    const query = `
        query ListResidents($filter: ModelResidentFilterInput) {
            listResidents(filter: $filter) {
                items {
                    id
                    firstName
                    lastName
                    externalId
                    addressId
                    hasSigned
                }
            }
        }
    `

    try {
        const data = await graphqlRequest(query, {
            filter: { externalId: { eq: externalId } }
        })
        const residents = data.listResidents.items

        console.log(`Found ${residents.length} resident(s)\n`)

        for (const resident of residents) {
            console.log(`${resident.firstName} ${resident.lastName}`)
            console.log(`  ID: ${resident.id}`)
            console.log(`  External ID: ${resident.externalId}`)
            console.log(`  Address ID: ${resident.addressId}`)
            console.log(`  Has Signed: ${resident.hasSigned ? 'YES' : 'NO'}`)
            console.log('')
        }
    } catch (err) {
        console.error('Failed to fetch resident:', err)
    }
}

main()
