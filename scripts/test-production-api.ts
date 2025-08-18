// Test production API connection and introspect schema
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
    console.log('Testing production API connection...')
    
    // Test 1: Simple query to check connection
    console.log('\n1. Testing API connection with listAddresses query:')
    const listQuery = `
        query ListAddresses {
            listAddresses(limit: 1) {
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
    
    const listResult = await graphqlRequest(listQuery)
    console.log('Response:', JSON.stringify(listResult, null, 2))
    
    // Test 2: Try introspection to understand the schema
    console.log('\n2. Checking available types:')
    const introspectionQuery = `
        query IntrospectionQuery {
            __type(name: "Mutation") {
                fields {
                    name
                    args {
                        name
                        type {
                            name
                            kind
                        }
                    }
                }
            }
        }
    `
    
    const introspectionResult = await graphqlRequest(introspectionQuery)
    if (introspectionResult.data) {
        const mutations = introspectionResult.data.__type?.fields || []
        const createMutations = mutations.filter((m: any) => m.name.startsWith('create'))
        console.log('Available create mutations:', createMutations.map((m: any) => m.name))
    } else {
        console.log('Introspection not available or failed:', introspectionResult)
    }
    
    // Test 3: Try a simple create mutation
    console.log('\n3. Testing createAddress mutation structure:')
    const testAddressMutation = `
        mutation TestCreateAddress {
            createAddress(input: {
                street: "TEST - 123 Test St"
                city: "Test City"
                state: "VA"
                zip: "20148"
            }) {
                id
                street
            }
        }
    `
    
    const testResult = await graphqlRequest(testAddressMutation)
    console.log('Create test result:', JSON.stringify(testResult, null, 2))
    
    // If successful, delete the test record
    if (testResult.data?.createAddress?.id) {
        console.log('\nCleaning up test record...')
        const deleteQuery = `
            mutation DeleteTestAddress {
                deleteAddress(input: { id: "${testResult.data.createAddress.id}" }) {
                    id
                }
            }
        `
        await graphqlRequest(deleteQuery)
        console.log('Test record deleted')
    }
}

main().catch(err => {
    console.error('Error:', err)
})