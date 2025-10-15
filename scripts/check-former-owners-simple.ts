// Simple check for former owners consents using API key
import fetch from 'node-fetch'
import Papa from 'papaparse'
import fs from 'fs'

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

    const result = await response.json() as any
    if (result.errors) {
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function main() {
    console.log('🔍 Checking which former owners have signed consents...\n')

    // Read former owners CSV
    const csvText = fs.readFileSync('.data/former_owers.csv', 'utf-8')
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
    const formerOwners = parsed.data as any[]

    console.log(`📋 Loaded ${formerOwners.length} former owners from CSV\n`)

    // Load all residents
    console.log('📥 Loading all residents...')
    let allResidents: any[] = []
    let nextToken = null

    do {
        const data = await graphqlRequest(`
            query ListResidents($limit: Int, $nextToken: String) {
                listResidents(limit: $limit, nextToken: $nextToken) {
                    items {
                        id
                        externalId
                        firstName
                        lastName
                        hasSigned
                    }
                    nextToken
                }
            }
        `, { limit: 1000, nextToken })

        allResidents.push(...data.listResidents.items)
        nextToken = data.listResidents.nextToken
    } while (nextToken)

    console.log(`✅ Loaded ${allResidents.length} residents\n`)

    // Load all consents
    console.log('📥 Loading all consents...')
    let allConsents: any[] = []
    nextToken = null

    do {
        const data = await graphqlRequest(`
            query ListConsents($limit: Int, $nextToken: String) {
                listConsents(limit: $limit, nextToken: $nextToken) {
                    items {
                        id
                        residentId
                        email
                        source
                        recordedAt
                    }
                    nextToken
                }
            }
        `, { limit: 1000, nextToken })

        allConsents.push(...data.listConsents.items)
        nextToken = data.listConsents.nextToken
    } while (nextToken)

    console.log(`✅ Loaded ${allConsents.length} consents\n`)

    // Create lookup
    const residentsWithConsents = new Set(allConsents.map((c: any) => c.residentId))
    const consentsByResidentId = new Map(allConsents.map((c: any) => [c.residentId, c]))

    // Check each former owner
    console.log('='.repeat(80))
    console.log('FORMER OWNERS CONSENT STATUS:')
    console.log('='.repeat(80) + '\n')

    let foundInDB = 0
    let notFoundInDB = 0
    let hasSigned = 0
    let notSigned = 0

    const signedList: any[] = []
    const notSignedList: any[] = []
    const notFoundList: any[] = []

    for (const owner of formerOwners) {
        const personId = owner.person_id?.trim()
        const firstName = owner['Occupant First Name']?.trim()
        const lastName = owner['Occupant Last Name']?.trim()

        if (!personId || !firstName || !lastName) continue

        const resident = allResidents.find((r: any) => r.externalId === personId)

        if (resident) {
            foundInDB++
            const consent = consentsByResidentId.get(resident.id)

            if (consent) {
                hasSigned++
                signedList.push({
                    personId,
                    name: `${firstName} ${lastName}`,
                    email: consent.email || 'N/A',
                    source: consent.source || 'N/A',
                    recordedAt: consent.recordedAt || 'N/A'
                })
                console.log(`✅ SIGNED: ${firstName} ${lastName} (ID: ${personId})`)
            } else {
                notSigned++
                notSignedList.push({ personId, name: `${firstName} ${lastName}` })
                console.log(`❌ NOT SIGNED: ${firstName} ${lastName} (ID: ${personId})`)
            }
        } else {
            notFoundInDB++
            notFoundList.push({ personId, name: `${firstName} ${lastName}` })
            console.log(`⚠️  NOT IN DB: ${firstName} ${lastName} (ID: ${personId})`)
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('SUMMARY:')
    console.log('='.repeat(80))
    console.log(`Total former owners in CSV: ${formerOwners.length}`)
    console.log(`Found in database: ${foundInDB}`)
    console.log(`Not found in database: ${notFoundInDB}`)
    console.log(`\nOf those found in database:`)
    console.log(`  ✅ Have signed: ${hasSigned}`)
    console.log(`  ❌ Have NOT signed: ${notSigned}`)
    console.log('='.repeat(80))

    if (signedList.length > 0) {
        console.log('\n📝 FORMER OWNERS WHO SIGNED:')
        console.log('-'.repeat(80))
        signedList.forEach(s => {
            console.log(`  ${s.name} (ID: ${s.personId})`)
            console.log(`    Email: ${s.email}`)
            console.log(`    Source: ${s.source}`)
        })
    }

    if (notFoundList.length > 0) {
        console.log('\n⚠️  FORMER OWNERS NOT IN DATABASE:')
        console.log('-'.repeat(80))
        notFoundList.forEach(n => {
            console.log(`  ${n.name} (ID: ${n.personId})`)
        })
    }
}

main().catch(console.error)
