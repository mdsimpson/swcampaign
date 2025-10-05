// Fuzzy search for residents by name in production
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

async function fuzzySearchResidents(searchTerm: string) {
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
        filter: {
            or: [
                { firstName: { contains: searchTerm } },
                { lastName: { contains: searchTerm } }
            ]
        }
    })
    return data.listResidents.items
}

async function main() {
    const searchTerm = process.argv[2]

    if (!searchTerm) {
        console.error('Usage: tsx scripts/search-resident-fuzzy.ts "<searchTerm>"')
        console.error('Example: tsx scripts/search-resident-fuzzy.ts "Masalia"')
        process.exit(1)
    }

    console.log(`🔍 Searching for residents matching "${searchTerm}" in production...\n`)

    try {
        const residents = await fuzzySearchResidents(searchTerm)

        if (residents.length === 0) {
            console.log(`❌ No residents found matching "${searchTerm}"`)
            process.exit(0)
        }

        console.log(`Found ${residents.length} resident(s):\n`)

        for (let i = 0; i < residents.length; i++) {
            const resident = residents[i]
            console.log(`${i + 1}. ${resident.firstName} ${resident.lastName}`)
            console.log(`   DB ID: ${resident.id}`)
            console.log(`   External ID: ${resident.externalId || 'NULL'}`)
            console.log(`   Address: ${resident.address?.street || 'N/A'}`)
            console.log(`   Email: ${resident.contactEmail || 'N/A'}`)
            console.log(`   Type: ${resident.occupantType || 'N/A'}`)
            console.log(`   Has Signed: ${resident.hasSigned ? '✅ YES' : '❌ NO'}`)
            console.log(`   Signed At: ${resident.signedAt || 'N/A'}`)
            console.log('')
        }

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
