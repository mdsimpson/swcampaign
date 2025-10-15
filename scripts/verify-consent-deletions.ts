import fetch from 'node-fetch'

// Production configuration
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

    const result = await response.json() as any
    if (result.errors) {
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

// List of person IDs that should no longer have consents
const personIdsChecked = [
    '55', '186', '280', '405', '460', '502', '631', '644', '746', '753',
    '1123', '1153', '1200', '1330', '1588', '1645', '1712', '1792', '1832', '1862', '2033'
]

async function listAllResidents() {
    const query = `
        query ListResidents($nextToken: String) {
            listResidents(limit: 1000, nextToken: $nextToken) {
                items {
                    id
                    personId
                    firstName
                    lastName
                }
                nextToken
            }
        }
    `

    const allResidents: any[] = []
    let nextToken: string | null = null

    do {
        const data = await graphqlRequest(query, { nextToken })
        allResidents.push(...data.listResidents.items)
        nextToken = data.listResidents.nextToken
    } while (nextToken)

    return allResidents
}

async function listAllConsents() {
    const query = `
        query ListConsents($nextToken: String) {
            listConsents(limit: 1000, nextToken: $nextToken) {
                items {
                    id
                    residentId
                }
                nextToken
            }
        }
    `

    const allConsents: any[] = []
    let nextToken: string | null = null

    do {
        const data = await graphqlRequest(query, { nextToken })
        allConsents.push(...data.listConsents.items)
        nextToken = data.listConsents.nextToken
    } while (nextToken)

    return allConsents
}

async function verify() {
    console.log('🔍 Verifying consent deletions...\n')

    const allResidents = await listAllResidents()
    console.log(`📋 Loaded ${allResidents.length} total residents`)

    const targetResidents = allResidents.filter(r =>
        r.personId && personIdsChecked.includes(r.personId)
    )

    console.log(`🎯 Found ${targetResidents.length} residents to check`)

    const residentIds = targetResidents.map(r => r.id)
    const allConsents = await listAllConsents()

    const remainingConsents = allConsents.filter(c =>
        residentIds.includes(c.residentId)
    )

    console.log(`\n📊 Verification Results:`)
    console.log(`  - Expected deletions: 21`)
    console.log(`  - Remaining consents for these residents: ${remainingConsents.length}`)

    if (remainingConsents.length === 0) {
        console.log('\n✅ SUCCESS: All 21 consents have been deleted!')
    } else {
        console.log(`\n⚠️  WARNING: Found ${remainingConsents.length} consents that should have been deleted:`)
        for (const consent of remainingConsents) {
            const resident = targetResidents.find(r => r.id === consent.residentId)
            console.log(`  - Consent ID ${consent.id}: person_id ${resident?.personId} - ${resident?.firstName} ${resident?.lastName}`)
        }
    }
}

verify()
    .then(() => {
        console.log('\n✅ Verification completed')
        process.exit(0)
    })
    .catch(error => {
        console.error('\n❌ Verification failed:', error)
        process.exit(1)
    })
