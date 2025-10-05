// Count all records in production database
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

async function countAll(modelName: string, listQuery: string) {
    let count = 0
    let nextToken: string | null = null

    do {
        const data = await graphqlRequest(listQuery, { nextToken, limit: 1000 })
        const key = `list${modelName}s`
        if (!data[key]) {
            console.error(`No data returned for ${key}`)
            return 0
        }
        count += data[key].items.length
        nextToken = data[key].nextToken
    } while (nextToken)

    return count
}

async function main() {
    console.log('📊 Counting records in production database...\n')

    try {
        // Count Addresses
        const addressQuery = `
            query ListAddresses($nextToken: String, $limit: Int) {
                listAddresses(nextToken: $nextToken, limit: $limit) {
                    items { id }
                    nextToken
                }
            }
        `
        const addressCount = await countAll('Address', addressQuery)
        console.log(`📍 Addresses: ${addressCount}`)

        // Count Residents
        const residentQuery = `
            query ListResidents($nextToken: String, $limit: Int) {
                listResidents(nextToken: $nextToken, limit: $limit) {
                    items { id hasSigned }
                    nextToken
                }
            }
        `
        const residents = await countResidentsWithSignedStatus()
        console.log(`👥 Residents: ${residents.total}`)
        console.log(`   ✅ Signed: ${residents.signed}`)
        console.log(`   ❌ Not signed: ${residents.notSigned}`)

        // Count Consents
        const consentQuery = `
            query ListConsents($nextToken: String, $limit: Int) {
                listConsents(nextToken: $nextToken, limit: $limit) {
                    items { id }
                    nextToken
                }
            }
        `
        const consentCount = await countAll('Consent', consentQuery)
        console.log(`📝 Consents: ${consentCount}`)

        // Count Assignments
        const assignmentQuery = `
            query ListAssignments($nextToken: String, $limit: Int) {
                listAssignments(nextToken: $nextToken, limit: $limit) {
                    items { id }
                    nextToken
                }
            }
        `
        const assignmentCount = await countAll('Assignment', assignmentQuery)
        console.log(`📋 Assignments: ${assignmentCount}`)

        // Count Interactions
        const interactionQuery = `
            query ListInteractionRecords($nextToken: String, $limit: Int) {
                listInteractionRecords(nextToken: $nextToken, limit: $limit) {
                    items { id }
                    nextToken
                }
            }
        `
        const interactionCount = await countAll('InteractionRecord', interactionQuery)
        console.log(`💬 Interaction Records: ${interactionCount}`)

    } catch (err) {
        console.error('Error:', err)
        process.exit(1)
    }
}

async function countResidentsWithSignedStatus() {
    let total = 0
    let signed = 0
    let notSigned = 0
    let nextToken: string | null = null

    const query = `
        query ListResidents($nextToken: String, $limit: Int) {
            listResidents(nextToken: $nextToken, limit: $limit) {
                items {
                    id
                    hasSigned
                }
                nextToken
            }
        }
    `

    do {
        const data = await graphqlRequest(query, { nextToken, limit: 1000 })
        const residents = data.listResidents.items

        total += residents.length
        signed += residents.filter((r: any) => r.hasSigned).length
        notSigned += residents.filter((r: any) => !r.hasSigned).length

        nextToken = data.listResidents.nextToken
    } while (nextToken)

    return { total, signed, notSigned }
}

main()
