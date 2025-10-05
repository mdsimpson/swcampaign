// Check if residents' addressId values match actual addresses
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
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
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function main() {
    console.log('🔍 Checking address-resident links...\n')

    // Get sample residents
    const residentsQuery = `
        query ListResidents($limit: Int) {
            listResidents(limit: $limit) {
                items {
                    id
                    firstName
                    lastName
                    addressId
                }
            }
        }
    `

    const residentsData = await graphqlRequest(residentsQuery, { limit: 5 })
    const residents = residentsData.listResidents.items

    console.log(`Checking ${residents.length} sample residents:\n`)

    for (const resident of residents) {
        console.log(`${resident.firstName} ${resident.lastName}`)
        console.log(`  Resident ID: ${resident.id}`)
        console.log(`  Address ID reference: ${resident.addressId}`)

        // Try to fetch the address
        const addressQuery = `
            query GetAddress($id: ID!) {
                getAddress(id: $id) {
                    id
                    street
                    city
                }
            }
        `

        try {
            const addressData = await graphqlRequest(addressQuery, { id: resident.addressId })
            if (addressData.getAddress) {
                console.log(`  ✅ Address found: ${addressData.getAddress.street}, ${addressData.getAddress.city}`)
            } else {
                console.log(`  ❌ Address NOT found (null)`)
            }
        } catch (err) {
            console.log(`  ❌ Error fetching address: ${err}`)
        }
        console.log('')
    }

    // Count totals
    const countResidentsQuery = `
        query ListResidents {
            listResidents(limit: 1000) {
                items {
                    id
                }
            }
        }
    `

    const countAddressesQuery = `
        query ListAddresses {
            listAddresses(limit: 1000) {
                items {
                    id
                }
            }
        }
    `

    const [residentCount, addressCount] = await Promise.all([
        graphqlRequest(countResidentsQuery),
        graphqlRequest(countAddressesQuery)
    ])

    console.log('='.repeat(60))
    console.log(`Total Residents: ${residentCount.listResidents.items.length}`)
    console.log(`Total Addresses: ${addressCount.listAddresses.items.length}`)
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
