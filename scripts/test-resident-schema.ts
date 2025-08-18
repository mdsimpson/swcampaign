// Test what fields the Resident model accepts in production
const GRAPHQL_ENDPOINT = 'https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql'
const API_KEY = 'da2-ilcaatyuoffcrjo73iy2rk4hxy'

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

async function main() {
    console.log('Testing Resident schema in production...\n')
    
    // First, get an address ID to use for testing
    const getAddressQuery = `
        query GetFirstAddress {
            listAddresses(limit: 1) {
                items {
                    id
                    street
                }
            }
        }
    `
    
    const addressResult = await graphqlRequest(getAddressQuery)
    if (!addressResult.data?.listAddresses?.items?.[0]) {
        console.error('No addresses found to test with')
        return
    }
    
    const testAddressId = addressResult.data.listAddresses.items[0].id
    console.log(`Using address ID: ${testAddressId}\n`)
    
    // Test 1: Try minimal required fields
    console.log('Test 1: Minimal fields (addressId, firstName, lastName)')
    const test1 = await graphqlRequest(`
        mutation TestMinimal($input: CreateResidentInput!) {
            createResident(input: $input) {
                id
                firstName
                lastName
                addressId
            }
        }
    `, {
        input: {
            addressId: testAddressId,
            firstName: 'TEST',
            lastName: 'MINIMAL'
        }
    })
    console.log('Result:', JSON.stringify(test1, null, 2))
    
    // Clean up if successful
    if (test1.data?.createResident?.id) {
        await graphqlRequest(`
            mutation DeleteTest {
                deleteResident(input: { id: "${test1.data.createResident.id}" }) {
                    id
                }
            }
        `)
        console.log('Cleaned up test record\n')
    }
    
    // Test 2: Try with all expected fields
    console.log('Test 2: All fields')
    const test2 = await graphqlRequest(`
        mutation TestAllFields($input: CreateResidentInput!) {
            createResident(input: $input) {
                id
                firstName
                lastName
                addressId
                email
                phone
                party
                role
                isAbsentee
                registeredVoter
                voteByMail
            }
        }
    `, {
        input: {
            addressId: testAddressId,
            firstName: 'TEST',
            lastName: 'ALLFIELDS',
            email: 'test@example.com',
            phone: '555-1234',
            party: 'Independent',
            role: 'Owner',
            isAbsentee: false,
            registeredVoter: true,
            voteByMail: false
        }
    })
    console.log('Result:', JSON.stringify(test2, null, 2))
    
    // Clean up if successful
    if (test2.data?.createResident?.id) {
        await graphqlRequest(`
            mutation DeleteTest {
                deleteResident(input: { id: "${test2.data.createResident.id}" }) {
                    id
                }
            }
        `)
        console.log('Cleaned up test record\n')
    }
    
    // Test 3: Check field types/names by introspection
    console.log('Test 3: Introspecting CreateResidentInput type')
    const introspectionQuery = `
        query IntrospectResidentInput {
            __type(name: "CreateResidentInput") {
                name
                inputFields {
                    name
                    type {
                        name
                        kind
                        ofType {
                            name
                            kind
                        }
                    }
                }
            }
        }
    `
    
    const introspectionResult = await graphqlRequest(introspectionQuery)
    if (introspectionResult.data?.__type?.inputFields) {
        console.log('Available fields for CreateResidentInput:')
        introspectionResult.data.__type.inputFields.forEach((field: any) => {
            const typeName = field.type.name || field.type.ofType?.name || 'Unknown'
            const required = field.type.kind === 'NON_NULL' ? ' (required)' : ''
            console.log(`  - ${field.name}: ${typeName}${required}`)
        })
    } else {
        console.log('Could not introspect schema:', introspectionResult)
    }
}

main().catch(err => {
    console.error('Error:', err)
})