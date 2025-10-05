// Diagnose why consent CSV entries aren't matching database residents
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
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

async function listAllResidents() {
    const query = `
        query ListResidents($limit: Int, $nextToken: String) {
            listResidents(limit: $limit, nextToken: $nextToken) {
                items {
                    id
                    firstName
                    lastName
                    addressId
                }
                nextToken
            }
        }
    `

    let allResidents: any[] = []
    let nextToken = null

    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allResidents = allResidents.concat(data.listResidents.items)
        nextToken = data.listResidents.nextToken
    } while (nextToken)

    return allResidents
}

async function listAllAddresses() {
    const query = `
        query ListAddresses($limit: Int, $nextToken: String) {
            listAddresses(limit: $limit, nextToken: $nextToken) {
                items {
                    id
                    street
                }
                nextToken
            }
        }
    `

    let allAddresses: any[] = []
    let nextToken = null

    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allAddresses = allAddresses.concat(data.listAddresses.items)
        nextToken = data.listAddresses.nextToken
    } while (nextToken)

    return allAddresses
}

async function main() {
    console.log('🔍 Diagnosing consent CSV matching issues...\n')

    // Load CSV
    const csvPath = './.data/matched_resident_ids.csv'
    console.log(`📂 Loading ${csvPath}...`)
    const csvContent = fs.readFileSync(csvPath, 'utf8')
    const rows = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    })
    console.log(`Found ${rows.length} rows in CSV\n`)

    // Load database data
    console.log('📋 Fetching all residents and addresses from database...')
    const [dbResidents, dbAddresses] = await Promise.all([
        listAllResidents(),
        listAllAddresses()
    ])
    console.log(`Found ${dbResidents.length} residents and ${dbAddresses.length} addresses in database\n`)

    // Create lookup maps
    const addressMap = new Map(dbAddresses.map(a => [a.id, a.street]))

    // Sample first 10 CSV rows and try to find matches
    console.log('🔎 Checking first 10 CSV entries:\n')

    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i]
        const firstName = row.resident_first_name?.trim()
        const lastName = row.resident_last_name?.trim()
        const street = row.resident_street?.trim() || row.expanded_street?.trim()

        console.log(`${i + 1}. CSV: ${firstName} ${lastName} at ${street}`)

        // Find by name
        const nameMatches = dbResidents.filter(r =>
            r.firstName?.toLowerCase() === firstName?.toLowerCase() &&
            r.lastName?.toLowerCase() === lastName?.toLowerCase()
        )

        if (nameMatches.length === 0) {
            console.log(`   ❌ No name match found in database`)
            // Try to find similar names
            const similarFirst = dbResidents.filter(r =>
                r.firstName?.toLowerCase().includes(firstName?.toLowerCase()) ||
                firstName?.toLowerCase().includes(r.firstName?.toLowerCase())
            )
            if (similarFirst.length > 0 && similarFirst.length <= 3) {
                console.log(`   💡 Similar first names found: ${similarFirst.map(r => `${r.firstName} ${r.lastName}`).join(', ')}`)
            }
        } else {
            console.log(`   ✓ Found ${nameMatches.length} name match(es)`)
            for (const match of nameMatches) {
                const dbStreet = addressMap.get(match.addressId)
                const streetsMatch = dbStreet?.toLowerCase() === street?.toLowerCase()
                console.log(`      - ${match.firstName} ${match.lastName} at ${dbStreet} ${streetsMatch ? '✅' : '❌ (street mismatch)'}`)
            }
        }
        console.log('')
    }

    // Stats
    let exactNameMatches = 0
    let streetMismatches = 0
    let noNameMatch = 0

    for (const row of rows) {
        const firstName = row.resident_first_name?.trim()
        const lastName = row.resident_last_name?.trim()
        const street = row.resident_street?.trim() || row.expanded_street?.trim()

        const nameMatches = dbResidents.filter(r =>
            r.firstName?.toLowerCase() === firstName?.toLowerCase() &&
            r.lastName?.toLowerCase() === lastName?.toLowerCase()
        )

        if (nameMatches.length > 0) {
            exactNameMatches++

            let foundStreetMatch = false
            for (const match of nameMatches) {
                const dbStreet = addressMap.get(match.addressId)
                if (dbStreet?.toLowerCase() === street?.toLowerCase()) {
                    foundStreetMatch = true
                    break
                }
            }

            if (!foundStreetMatch) {
                streetMismatches++
            }
        } else {
            noNameMatch++
        }
    }

    console.log('='.repeat(60))
    console.log('=== Summary ===')
    console.log(`Total CSV entries: ${rows.length}`)
    console.log(`Exact name matches: ${exactNameMatches}`)
    console.log(`  - With street mismatch: ${streetMismatches}`)
    console.log(`No name match in DB: ${noNameMatch}`)
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
