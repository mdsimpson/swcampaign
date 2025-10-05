// Check how many residents have externalId values populated
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
    return result
}

async function checkExternalIdPopulation() {
    const query = `
        query ListResidents($limit: Int, $nextToken: String) {
            listResidents(limit: $limit, nextToken: $nextToken) {
                items {
                    id
                    externalId
                    firstName
                    lastName
                }
                nextToken
            }
        }
    `

    let allResidents: any[] = []
    let nextToken = null
    let iterations = 0

    do {
        const result = await graphqlRequest(query, { limit: 1000, nextToken })

        if (result.errors) {
            console.error('GraphQL errors:', JSON.stringify(result.errors))
            break
        }

        if (result.data && result.data.listResidents) {
            allResidents = allResidents.concat(result.data.listResidents.items)
            nextToken = result.data.listResidents.nextToken
            iterations++
            console.log(`Fetched ${allResidents.length} residents so far...`)
        } else {
            break
        }
    } while (nextToken && iterations < 10)

    return allResidents
}

async function main() {
    console.log('🔍 Checking externalId population in production...\n')

    try {
        const residents = await checkExternalIdPopulation()

        const withExternalId = residents.filter(r => r.externalId)
        const withoutExternalId = residents.filter(r => !r.externalId)

        console.log('\n=== Results ===')
        console.log(`Total residents: ${residents.length}`)
        console.log(`With externalId: ${withExternalId.length}`)
        console.log(`Without externalId (NULL): ${withoutExternalId.length}`)

        if (withExternalId.length > 0) {
            console.log('\n=== Sample with externalId (first 10) ===')
            withExternalId.slice(0, 10).forEach(r => {
                console.log(`  ID: ${r.externalId} - ${r.firstName} ${r.lastName}`)
            })
        }

        if (withoutExternalId.length > 0) {
            console.log('\n=== Sample without externalId (first 10) ===')
            withoutExternalId.slice(0, 10).forEach(r => {
                console.log(`  ${r.firstName} ${r.lastName}`)
            })
        }

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
