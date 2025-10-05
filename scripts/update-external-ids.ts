// Update externalId for all residents in production by matching to residents2.csv
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ilcaatyuoffcrjo73iy2rk4hxy"

type ResidentRow = {
    id: string
    'Occupant First Name': string
    'Occupant Last Name': string
    'Occupant Type': string
    Street: string
    City: string
    State: string
    Zip: string
    address_id: string
}

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
                    externalId
                    firstName
                    lastName
                    address {
                        street
                    }
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

async function updateResidentExternalId(residentId: string, externalId: string) {
    const mutation = `
        mutation UpdateResident($input: UpdateResidentInput!) {
            updateResident(input: $input) {
                id
                externalId
                firstName
                lastName
            }
        }
    `

    const data = await graphqlRequest(mutation, {
        input: {
            id: residentId,
            externalId: externalId
        }
    })
    return data.updateResident
}

async function main() {
    console.log('🚀 Updating externalId for all residents in production...\n')

    // Load residents CSV
    console.log('📂 Loading residents2.csv...')
    const residentsCsv = fs.readFileSync('./.data/residents2.csv', 'utf8')
    const csvResidents: ResidentRow[] = parse(residentsCsv, {
        columns: true,
        skip_empty_lines: true
    })
    console.log(`Loaded ${csvResidents.length} residents from CSV\n`)

    // Load all residents from database
    console.log('🔍 Fetching all residents from production database...')
    const dbResidents = await listAllResidents()
    console.log(`Found ${dbResidents.length} residents in database\n`)

    // Match and update
    console.log('🔄 Matching and updating externalIds...\n')

    let matched = 0
    let updated = 0
    let alreadyHaveExternalId = 0
    let notFound = 0

    for (const dbResident of dbResidents) {
        // Find matching CSV resident by first name, last name, and street
        const csvMatch = csvResidents.find(csv =>
            csv['Occupant First Name']?.toLowerCase() === dbResident.firstName?.toLowerCase() &&
            csv['Occupant Last Name']?.toLowerCase() === dbResident.lastName?.toLowerCase() &&
            csv.Street?.toLowerCase() === dbResident.address?.street?.toLowerCase()
        )

        if (csvMatch) {
            matched++

            if (dbResident.externalId) {
                alreadyHaveExternalId++
                if (dbResident.externalId !== csvMatch.id) {
                    console.log(`⚠️  ${dbResident.firstName} ${dbResident.lastName} at ${dbResident.address?.street}: externalId mismatch (DB: ${dbResident.externalId}, CSV: ${csvMatch.id})`)
                }
            } else {
                // Update the resident with externalId from CSV
                try {
                    await updateResidentExternalId(dbResident.id, csvMatch.id)
                    updated++
                    if (updated % 50 === 0) {
                        console.log(`  Updated ${updated} residents...`)
                    }
                } catch (err) {
                    console.error(`  ❌ Error updating ${dbResident.firstName} ${dbResident.lastName}:`, err)
                }
            }
        } else {
            notFound++
            console.log(`  ⚠️  No CSV match for: ${dbResident.firstName} ${dbResident.lastName} at ${dbResident.address?.street}`)
        }
    }

    console.log('\n=== Update Complete ===')
    console.log(`Total residents in DB: ${dbResidents.length}`)
    console.log(`Matched to CSV: ${matched}`)
    console.log(`Already had externalId: ${alreadyHaveExternalId}`)
    console.log(`Updated with externalId: ${updated}`)
    console.log(`Not found in CSV: ${notFound}`)

    if (updated > 0) {
        console.log('\n✅ ExternalIds successfully updated!')
        console.log('You can now use the consent CSV upload feature.')
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
