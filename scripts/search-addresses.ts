// Search for addresses and their residents in production
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

async function searchAddresses(street: string) {
    const query = `
        query ListAddresses($filter: ModelAddressFilterInput) {
            listAddresses(filter: $filter) {
                items {
                    id
                    street
                    city
                    state
                    zip
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { street: { contains: street } }
    })
    return data.listAddresses.items
}

async function getResidentsByAddressId(addressId: string) {
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
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { addressId: { eq: addressId } }
    })
    return data.listResidents.items
}

async function main() {
    const street = process.argv[2]

    if (!street) {
        console.error('Usage: tsx scripts/search-addresses.ts "<street>"')
        console.error('Example: tsx scripts/search-addresses.ts "Cloverleaf"')
        process.exit(1)
    }

    console.log(`🔍 Searching for addresses containing "${street}" in production...\n`)

    try {
        const addresses = await searchAddresses(street)

        if (addresses.length === 0) {
            console.log(`❌ No addresses found containing "${street}"`)
            process.exit(0)
        }

        console.log(`Found ${addresses.length} address(es):\n`)

        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i]
            console.log(`${i + 1}. ${address.street}`)
            console.log(`   Address ID: ${address.id}`)
            console.log(`   City: ${address.city || 'N/A'}`)
            console.log(`   State: ${address.state || 'N/A'}`)
            console.log(`   Zip: ${address.zip || 'N/A'}`)

            // Get residents at this address
            const residents = await getResidentsByAddressId(address.id)
            console.log(`   Residents: ${residents.length}`)

            if (residents.length > 0) {
                residents.forEach((r, idx) => {
                    console.log(`      ${idx + 1}) ${r.firstName} ${r.lastName}`)
                    console.log(`         DB ID: ${r.id}`)
                    console.log(`         External ID: ${r.externalId || 'NULL'}`)
                    console.log(`         Email: ${r.contactEmail || 'N/A'}`)
                    console.log(`         Has Signed: ${r.hasSigned ? '✅ YES' : '❌ NO'}`)
                })
            }

            console.log('')
        }

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
