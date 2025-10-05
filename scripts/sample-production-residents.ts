// Get a sample of production residents to check externalId field
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

async function getSampleResidents() {
    const query = `
        query ListResidents($limit: Int) {
            listResidents(limit: $limit) {
                items {
                    id
                    externalId
                    firstName
                    lastName
                    contactEmail
                    hasSigned
                }
            }
        }
    `
    const data = await graphqlRequest(query, { limit: 20 })
    return data.listResidents.items
}

async function main() {
    console.log('📋 Fetching sample residents from production...\n')

    try {
        const residents = await getSampleResidents()

        console.log(`Found ${residents.length} residents (showing first 20):\n`)

        let hasExternalId = 0
        let noExternalId = 0

        residents.forEach((r: any, idx: number) => {
            console.log(`${idx + 1}. ${r.firstName || 'N/A'} ${r.lastName || 'N/A'}`)
            console.log(`   DB ID: ${r.id}`)
            console.log(`   External ID: ${r.externalId || 'NULL'}`)
            console.log(`   Email: ${r.contactEmail || 'N/A'}`)
            console.log(`   Has Signed: ${r.hasSigned ? 'YES' : 'NO'}`)
            console.log('')

            if (r.externalId) {
                hasExternalId++
            } else {
                noExternalId++
            }
        })

        console.log('=== Summary ===')
        console.log(`Residents with externalId: ${hasExternalId}`)
        console.log(`Residents without externalId: ${noExternalId}`)

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
