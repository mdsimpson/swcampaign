// Search for residents by address in production
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

async function searchByAddress(street: string) {
    // First find the address
    const addressQuery = `
        query ListAddresses($filter: ModelAddressFilterInput) {
            listAddresses(filter: $filter) {
                items {
                    id
                    street
                }
            }
        }
    `
    const addressData = await graphqlRequest(addressQuery, {
        filter: { street: { contains: street } }
    })

    if (addressData.listAddresses.items.length === 0) {
        return { address: null, residents: [] }
    }

    const address = addressData.listAddresses.items[0]

    // Get residents at this address
    const residentQuery = `
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
    const residentData = await graphqlRequest(residentQuery, {
        filter: { addressId: { eq: address.id } }
    })

    return { address, residents: residentData.listResidents.items }
}

async function main() {
    const street = process.argv[2]

    if (!street) {
        console.error('Usage: tsx scripts/search-by-address.ts "<address>"')
        console.error('Example: tsx scripts/search-by-address.ts "42923 Cloverleaf"')
        process.exit(1)
    }

    console.log(`🔍 Searching for address containing "${street}" in production...\n`)

    try {
        const { address, residents } = await searchByAddress(street)

        if (!address) {
            console.log(`❌ No address found matching "${street}"`)
            process.exit(0)
        }

        console.log(`📍 Address: ${address.street}`)
        console.log(`   ID: ${address.id}\n`)

        if (residents.length === 0) {
            console.log('No residents found at this address')
            process.exit(0)
        }

        console.log(`Found ${residents.length} resident(s):\n`)

        for (let i = 0; i < residents.length; i++) {
            const resident = residents[i]
            console.log(`${i + 1}. ${resident.firstName} ${resident.lastName}`)
            console.log(`   ID: ${resident.id}`)
            console.log(`   External ID: ${resident.externalId || 'N/A'}`)
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
