// Delete all data from CURRENT production environment
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

async function deleteAllConsents() {
    console.log('🗑️  Deleting all consents...')
    const query = `
        query ListConsents($limit: Int, $nextToken: String) {
            listConsents(limit: $limit, nextToken: $nextToken) {
                items { id }
                nextToken
            }
        }
    `
    const deleteMutation = `
        mutation DeleteConsent($input: DeleteConsentInput!) {
            deleteConsent(input: $input) { id }
        }
    `

    let allItems: any[] = []
    let nextToken = null
    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allItems = allItems.concat(data.listConsents.items)
        nextToken = data.listConsents.nextToken
    } while (nextToken)

    console.log(`Found ${allItems.length} consents to delete`)

    for (const item of allItems) {
        await graphqlRequest(deleteMutation, { input: { id: item.id } })
    }
    console.log(`✅ Deleted ${allItems.length} consents`)
}

async function deleteAllAssignments() {
    console.log('🗑️  Deleting all assignments...')
    const query = `
        query ListAssignments($limit: Int, $nextToken: String) {
            listAssignments(limit: $limit, nextToken: $nextToken) {
                items { id }
                nextToken
            }
        }
    `
    const deleteMutation = `
        mutation DeleteAssignment($input: DeleteAssignmentInput!) {
            deleteAssignment(input: $input) { id }
        }
    `

    let allItems: any[] = []
    let nextToken = null
    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allItems = allItems.concat(data.listAssignments.items)
        nextToken = data.listAssignments.nextToken
    } while (nextToken)

    console.log(`Found ${allItems.length} assignments to delete`)

    for (const item of allItems) {
        await graphqlRequest(deleteMutation, { input: { id: item.id } })
    }
    console.log(`✅ Deleted ${allItems.length} assignments`)
}

async function deleteAllResidents() {
    console.log('🗑️  Deleting all residents...')
    const query = `
        query ListResidents($limit: Int, $nextToken: String) {
            listResidents(limit: $limit, nextToken: $nextToken) {
                items { id }
                nextToken
            }
        }
    `
    const deleteMutation = `
        mutation DeleteResident($input: DeleteResidentInput!) {
            deleteResident(input: $input) { id }
        }
    `

    let allItems: any[] = []
    let nextToken = null
    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allItems = allItems.concat(data.listResidents.items)
        nextToken = data.listResidents.nextToken
    } while (nextToken)

    console.log(`Found ${allItems.length} residents to delete`)

    let deleted = 0
    for (const item of allItems) {
        await graphqlRequest(deleteMutation, { input: { id: item.id } })
        deleted++
        if (deleted % 100 === 0) {
            console.log(`  Deleted ${deleted}/${allItems.length}...`)
        }
    }
    console.log(`✅ Deleted ${allItems.length} residents`)
}

async function deleteAllAddresses() {
    console.log('🗑️  Deleting all addresses...')
    const query = `
        query ListAddresses($limit: Int, $nextToken: String) {
            listAddresses(limit: $limit, nextToken: $nextToken) {
                items { id }
                nextToken
            }
        }
    `
    const deleteMutation = `
        mutation DeleteAddress($input: DeleteAddressInput!) {
            deleteAddress(input: $input) { id }
        }
    `

    let allItems: any[] = []
    let nextToken = null
    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allItems = allItems.concat(data.listAddresses.items)
        nextToken = data.listAddresses.nextToken
    } while (nextToken)

    console.log(`Found ${allItems.length} addresses to delete`)

    let deleted = 0
    for (const item of allItems) {
        await graphqlRequest(deleteMutation, { input: { id: item.id } })
        deleted++
        if (deleted % 100 === 0) {
            console.log(`  Deleted ${deleted}/${allItems.length}...`)
        }
    }
    console.log(`✅ Deleted ${allItems.length} addresses`)
}

async function main() {
    console.log('⚠️  WARNING: This will DELETE ALL data from current production!')
    console.log('Endpoint:', GRAPHQL_ENDPOINT)
    console.log('')

    try {
        // Delete in order (to handle foreign key constraints)
        await deleteAllConsents()
        await deleteAllAssignments()
        await deleteAllResidents()
        await deleteAllAddresses()

        console.log('')
        console.log('='.repeat(60))
        console.log('✅ All data deleted from current production!')
    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

main()
