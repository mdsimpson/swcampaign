// Delete all residents and addresses from production database
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

async function deleteAllResidents() {
    console.log('🗑️  Deleting all residents...')
    let deletedCount = 0
    let nextToken: string | null = null

    const listQuery = `
        query ListResidents($nextToken: String) {
            listResidents(limit: 100, nextToken: $nextToken) {
                items {
                    id
                }
                nextToken
            }
        }
    `

    const deleteMutation = `
        mutation DeleteResident($input: DeleteResidentInput!) {
            deleteResident(input: $input) {
                id
            }
        }
    `

    do {
        const data = await graphqlRequest(listQuery, { nextToken })
        const residents = data.listResidents.items

        for (const resident of residents) {
            try {
                await graphqlRequest(deleteMutation, { input: { id: resident.id } })
                deletedCount++
                if (deletedCount % 50 === 0) {
                    console.log(`  Deleted ${deletedCount} residents...`)
                }
            } catch (err) {
                console.error(`  Error deleting resident ${resident.id}:`, err)
            }
        }

        nextToken = data.listResidents.nextToken
    } while (nextToken)

    console.log(`✅ Deleted ${deletedCount} residents\n`)
    return deletedCount
}

async function deleteAllAddresses() {
    console.log('🗑️  Deleting all addresses...')
    let deletedCount = 0
    let nextToken: string | null = null

    const listQuery = `
        query ListAddresses($nextToken: String) {
            listAddresses(limit: 100, nextToken: $nextToken) {
                items {
                    id
                }
                nextToken
            }
        }
    `

    const deleteMutation = `
        mutation DeleteAddress($input: DeleteAddressInput!) {
            deleteAddress(input: $input) {
                id
            }
        }
    `

    do {
        const data = await graphqlRequest(listQuery, { nextToken })
        const addresses = data.listAddresses.items

        for (const address of addresses) {
            try {
                await graphqlRequest(deleteMutation, { input: { id: address.id } })
                deletedCount++
                if (deletedCount % 50 === 0) {
                    console.log(`  Deleted ${deletedCount} addresses...`)
                }
            } catch (err) {
                console.error(`  Error deleting address ${address.id}:`, err)
            }
        }

        nextToken = data.listAddresses.nextToken
    } while (nextToken)

    console.log(`✅ Deleted ${deletedCount} addresses\n`)
    return deletedCount
}

async function main() {
    console.log('⚠️  WARNING: This will DELETE ALL residents and addresses from production!')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    console.log('\nPress Ctrl+C within 5 seconds to cancel...\n')

    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('🚀 Starting deletion process...\n')

    // Delete residents first (because they reference addresses)
    const residentsDeleted = await deleteAllResidents()

    // Then delete addresses
    const addressesDeleted = await deleteAllAddresses()

    console.log('=== Deletion Complete ===')
    console.log(`Residents deleted: ${residentsDeleted}`)
    console.log(`Addresses deleted: ${addressesDeleted}`)
    console.log('\n✅ Production database cleared!')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
