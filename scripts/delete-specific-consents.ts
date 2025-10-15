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

// List of person IDs to delete consents for
const personIdsToDelete = [
    '55',    // Alwalid Ali Musa - 21816 Wingfoot Ct
    '186',   // Baskar Marimuthu - 21948 Windy Oaks Sq
    '280',   // Chad Sonnenfeld - 42792 Ridgeway Dr
    '405',   // David Miller - 43007 Park Creek Dr
    '460',   // Dinesh Jadhav - 21863 Engleside Pl
    '502',   // Edward Nathan - 21825 Ainsley Ct
    '631',   // Gustavo Garcia - 22018 Avonworth Sq
    '644',   // Harish Jayakumar - 21936 Bayard Ter
    '746',   // Jay Buxton - 21971 Sunstone Ct
    '753',   // Jayesh Amdekar - 21896 Schenley Terrace
    '1123',  // Matthew Gentilcore - 42749 Ridgeway Dr
    '1153',  // Merrick Mayhew - 22050 Dilworth Sq
    '1200',  // Michael Rossiter - 21990 Sunstone Ct
    '1330',  // Padmaja Thirupati - 21942 Windover Dr
    '1588',  // Sandesh Jadhav - 42845 Sandhurst Ct
    '1645',  // Shailender Salimadugu - 42821 Heritage Oak Ct
    '1712',  // Sreenivasulu Chennupati - 22016 Dilworth Sq
    '1792',  // Sung Kim - 43231 Becontree Ter
    '1832',  // Thiyagarajan Ramasamy - 42764 Ridgeway Dr
    '1862',  // Todd Craig - 22119 Whisperhill Ct
    '2033',  // JENNIFER JENNRICH - 43273 Tumbletree Ter
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

async function deleteConsent(id: string) {
    const mutation = `
        mutation DeleteConsent($input: DeleteConsentInput!) {
            deleteConsent(input: $input) {
                id
            }
        }
    `
    await graphqlRequest(mutation, { input: { id } })
}

async function deleteConsents() {
    console.log('🔍 Finding residents with person IDs to delete consents...')

    // First, find all residents with these person IDs
    const allResidents = await listAllResidents()
    console.log(`📋 Loaded ${allResidents.length} total residents`)

    // Filter to only residents with matching person IDs
    const targetResidents = allResidents.filter(r =>
        r.personId && personIdsToDelete.includes(r.personId)
    )

    console.log(`🎯 Found ${targetResidents.length} residents matching the person IDs`)

    if (targetResidents.length === 0) {
        console.log('❌ No residents found with those person IDs')
        return
    }

    // Display the residents we found
    console.log('\n📝 Residents found:')
    targetResidents.forEach(r => {
        console.log(`  - person_id ${r.personId}: ${r.firstName} ${r.lastName}`)
    })

    // Get resident IDs
    const residentIds = targetResidents.map(r => r.id)

    // Find all consents for these residents
    console.log('\n🔍 Looking for consents...')
    const allConsents = await listAllConsents()

    // Filter to consents for our target residents
    const consentsToDelete = allConsents.filter(c =>
        residentIds.includes(c.residentId)
    )

    console.log(`\n✅ Found ${consentsToDelete.length} consent records to delete`)

    if (consentsToDelete.length === 0) {
        console.log('ℹ️  No consents found for these residents')
        return
    }

    // Display what we're about to delete
    console.log('\n🗑️  Consents to be deleted:')
    for (const consent of consentsToDelete) {
        const resident = targetResidents.find(r => r.id === consent.residentId)
        console.log(`  - Consent ID ${consent.id}: person_id ${resident?.personId} - ${resident?.firstName} ${resident?.lastName}`)
    }

    // Delete the consents
    console.log('\n🚀 Starting deletion...')
    let deletedCount = 0
    let errorCount = 0

    for (const consent of consentsToDelete) {
        try {
            await deleteConsent(consent.id)
            const resident = targetResidents.find(r => r.id === consent.residentId)
            console.log(`  ✓ Deleted consent for person_id ${resident?.personId}: ${resident?.firstName} ${resident?.lastName}`)
            deletedCount++
        } catch (error) {
            console.error(`  ✗ Failed to delete consent ${consent.id}:`, error)
            errorCount++
        }
    }

    console.log(`\n📊 Summary:`)
    console.log(`  - Deleted: ${deletedCount}`)
    console.log(`  - Errors: ${errorCount}`)
    console.log(`  - Total processed: ${consentsToDelete.length}`)
}

deleteConsents()
    .then(() => {
        console.log('\n✅ Script completed')
        process.exit(0)
    })
    .catch(error => {
        console.error('\n❌ Script failed:', error)
        process.exit(1)
    })
