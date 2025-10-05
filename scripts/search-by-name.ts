// Search for a resident by first and last name
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
        console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2))
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function main() {
    const firstName = process.argv[2] || 'Aaron'
    const lastName = process.argv[3] || 'Bice'

    console.log(`🔍 Searching for: ${firstName} ${lastName}\n`)

    const query = `
        query ListResidents($filter: ModelResidentFilterInput) {
            listResidents(filter: $filter) {
                items {
                    id
                    firstName
                    lastName
                    externalId
                    addressId
                    address {
                        street
                        city
                    }
                }
            }
        }
    `

    try {
        const data = await graphqlRequest(query, {
            filter: {
                and: [
                    { firstName: { eq: firstName } },
                    { lastName: { eq: lastName } }
                ]
            }
        })

        const residents = data.listResidents.items

        if (residents.length === 0) {
            console.log('❌ NOT FOUND\n')
            console.log('Trying case-insensitive search...\n')

            // Try searching all residents and filtering client-side
            const allQuery = `
                query ListResidents {
                    listResidents(limit: 2000) {
                        items {
                            firstName
                            lastName
                            address {
                                street
                            }
                        }
                    }
                }
            `
            const allData = await graphqlRequest(allQuery, {})
            const allResidents = allData.listResidents.items

            const matches = allResidents.filter(r =>
                r.firstName?.toLowerCase() === firstName.toLowerCase() &&
                r.lastName?.toLowerCase() === lastName.toLowerCase()
            )

            if (matches.length > 0) {
                console.log(`✅ Found ${matches.length} case-insensitive match(es):\n`)
                matches.forEach(r => {
                    console.log(`  ${r.firstName} ${r.lastName} at ${r.address?.street}`)
                })
            } else {
                console.log('Still not found. Checking for similar names...\n')
                const similar = allResidents.filter(r =>
                    r.firstName?.toLowerCase().includes(firstName.toLowerCase()) &&
                    r.lastName?.toLowerCase().includes(lastName.toLowerCase())
                )

                if (similar.length > 0) {
                    console.log(`Found ${similar.length} similar name(s):\n`)
                    similar.slice(0, 5).forEach(r => {
                        console.log(`  ${r.firstName} ${r.lastName} at ${r.address?.street}`)
                    })
                } else {
                    console.log('No similar names found.')
                }
            }
        } else {
            console.log(`✅ Found ${residents.length} resident(s):\n`)
            residents.forEach(r => {
                console.log(`${r.firstName} ${r.lastName}`)
                console.log(`  External ID: ${r.externalId || 'N/A'}`)
                console.log(`  Address: ${r.address?.street}, ${r.address?.city}`)
                console.log('')
            })
        }
    } catch (err) {
        console.error('Failed to search:', err)
    }
}

main()
