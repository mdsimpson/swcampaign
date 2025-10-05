// Sample residents from database to see what data exists
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
        console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2))
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function main() {
    console.log('📋 Sampling residents from database...\n')

    const query = `
        query ListResidents($limit: Int) {
            listResidents(limit: $limit) {
                items {
                    id
                    firstName
                    lastName
                    externalId
                    personId
                    addressId
                    hasSigned
                }
            }
        }
    `

    try {
        const data = await graphqlRequest(query, { limit: 10 })
        const residents = data.listResidents.items

        console.log(`Total fetched: ${residents.length}\n`)

        for (const resident of residents) {
            console.log(`${resident.firstName} ${resident.lastName}`)
            console.log(`  ID: ${resident.id}`)
            console.log(`  External ID: ${resident.externalId || 'N/A'}`)
            console.log(`  Person ID: ${resident.personId || 'N/A'}`)
            console.log(`  Address ID: ${resident.addressId}`)
            console.log(`  Has Signed: ${resident.hasSigned ? 'YES' : 'NO'}`)
            console.log('')
        }
    } catch (err) {
        console.error('Failed to fetch residents:', err)
    }
}

main()
