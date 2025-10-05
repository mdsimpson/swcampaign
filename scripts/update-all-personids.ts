// Update personId for all residents without deleting/recreating
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://bwng3ppgdfhl5cnfzv3difc4vm.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-mgxvgdjuffbvpcz4gljvulnw4m"

type ResidentRow = {
    person_id: string
    'Occupant First Name': string
    'Occupant Last Name': string
    Street: string
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
                    firstName
                    lastName
                    personId
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
        console.log(`Fetched ${allResidents.length} residents so far...`)
    } while (nextToken)

    return allResidents
}

async function updateResidentPersonId(residentId: string, personId: string) {
    const mutation = `
        mutation UpdateResident($input: UpdateResidentInput!) {
            updateResident(input: $input) {
                id
                personId
                firstName
                lastName
            }
        }
    `
    const data = await graphqlRequest(mutation, {
        input: {
            id: residentId,
            personId: personId
        }
    })
    return data.updateResident
}

async function main() {
    console.log('🔄 Updating personId for all residents in production...\n')

    // Load CSV
    console.log('📂 Loading residents2.csv...')
    const csvContent = fs.readFileSync('./.data/residents2.csv', 'utf8')
    const csvResidents: ResidentRow[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    })
    console.log(`Loaded ${csvResidents.length} residents from CSV\n`)

    // Load all residents from database
    console.log('🔍 Fetching all residents from production...')
    const dbResidents = await listAllResidents()
    console.log(`\nFound ${dbResidents.length} residents in database\n`)

    // Match and update
    console.log('🔄 Matching and updating personIds...\n')

    let matched = 0
    let updated = 0
    let alreadyHavePersonId = 0
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

            if (dbResident.personId) {
                alreadyHavePersonId++
                if (dbResident.personId !== csvMatch.person_id) {
                    console.log(`⚠️  ${dbResident.firstName} ${dbResident.lastName} at ${dbResident.address?.street}: personId mismatch (DB: ${dbResident.personId}, CSV: ${csvMatch.person_id})`)
                }
            } else {
                // Update the resident with personId from CSV
                try {
                    await updateResidentPersonId(dbResident.id, csvMatch.person_id)
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

    console.log('\n' + '='.repeat(60))
    console.log('=== Update Complete ===')
    console.log(`Total residents in DB: ${dbResidents.length}`)
    console.log(`Matched to CSV: ${matched}`)
    console.log(`Already had personId: ${alreadyHavePersonId}`)
    console.log(`Updated with personId: ${updated}`)
    console.log(`Not found in CSV: ${notFound}`)

    if (updated > 0) {
        console.log('\n✅ PersonIds successfully updated!')
        console.log('You can now use the consent CSV upload feature.')
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
