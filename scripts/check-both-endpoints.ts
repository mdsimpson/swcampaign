// Check both endpoints to see which has data
import fetch from 'node-fetch'

const NEW_ENDPOINT = "https://bwng3ppgdfhl5cnfzv3difc4vm.appsync-api.us-east-1.amazonaws.com/graphql"
const OLD_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-mgxvgdjuffbvpcz4gljvulnw4m"

async function graphqlRequest(endpoint: string, query: string, variables: any = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({ query, variables })
    })

    const result = await response.json()
    if (result.errors) {
        return { error: result.errors }
    }
    return result.data
}

async function checkEndpoint(endpoint: string, label: string) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`${label}: ${endpoint}`)
    console.log('='.repeat(60))

    const query = `
        query ListResidents($limit: Int) {
            listResidents(limit: $limit) {
                items {
                    firstName
                    lastName
                    externalId
                }
            }
        }
    `

    try {
        const data = await graphqlRequest(endpoint, query, { limit: 5 })

        if (data.error) {
            console.log('❌ Error:', JSON.stringify(data.error))
            return
        }

        const residents = data.listResidents?.items || []
        console.log(`✅ Found ${residents.length} residents (showing first 5):\n`)

        residents.forEach((r: any) => {
            console.log(`  - ${r.firstName} ${r.lastName} (externalId: ${r.externalId || 'N/A'})`)
        })
    } catch (err) {
        console.log('❌ Error:', err)
    }
}

async function main() {
    console.log('Checking both GraphQL endpoints...')

    await checkEndpoint(NEW_ENDPOINT, 'NEW ENDPOINT (current amplify_outputs.json)')
    await checkEndpoint(OLD_ENDPOINT, 'OLD ENDPOINT')
}

main()
