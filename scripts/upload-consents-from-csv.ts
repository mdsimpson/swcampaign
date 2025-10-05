// Upload consents from matched_resident_ids.csv to production
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://bwng3ppgdfhl5cnfzv3difc4vm.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ngrxku5bhzezhih2pxgitb6mtq"

type MatchedResidentRow = {
    id: string
    expanded_name: string
    expanded_email: string
    expanded_street: string
    resident_street: string
    resident_first_name: string
    resident_last_name: string
    resident_email: string
    match_type: string
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

async function findResidentByExternalId(externalId: string) {
    const query = `
        query ListResidents($filter: ModelResidentFilterInput) {
            listResidents(filter: $filter) {
                items {
                    id
                    externalId
                    firstName
                    lastName
                    addressId
                    hasSigned
                    address {
                        street
                    }
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { externalId: { eq: externalId } }
    })
    return data.listResidents.items
}

async function createConsent(residentId: string, addressId: string) {
    const mutation = `
        mutation CreateConsent($input: CreateConsentInput!) {
            createConsent(input: $input) {
                id
                residentId
                addressId
            }
        }
    `
    const data = await graphqlRequest(mutation, {
        input: {
            residentId,
            addressId,
            recordedAt: new Date().toISOString(),
            source: 'csv-upload'
        }
    })
    return data.createConsent
}

async function updateResidentSigned(residentId: string) {
    const mutation = `
        mutation UpdateResident($input: UpdateResidentInput!) {
            updateResident(input: $input) {
                id
                hasSigned
                signedAt
            }
        }
    `
    const data = await graphqlRequest(mutation, {
        input: {
            id: residentId,
            hasSigned: true,
            signedAt: new Date().toISOString()
        }
    })
    return data.updateResident
}

async function main() {
    console.log('🚀 Uploading consents from CSV to production...\n')

    // Load CSV
    const csvPath = './.data/matched_resident_ids.csv'
    console.log(`📂 Loading ${csvPath}...`)
    const csvContent = fs.readFileSync(csvPath, 'utf8')
    const rows: MatchedResidentRow[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    })
    console.log(`Found ${rows.length} rows to process\n`)

    let processed = 0
    let consentsCreated = 0
    let alreadySigned = 0
    let notFound = 0
    const errors: string[] = []

    console.log('🔄 Processing rows...\n')

    for (const row of rows) {
        const externalId = row.id

        if (!externalId) {
            processed++
            continue
        }

        try {
            // Find resident by externalId
            const residents = await findResidentByExternalId(externalId)

            if (residents.length === 0) {
                notFound++
                errors.push(`ID ${externalId}: Not found (${row.resident_first_name} ${row.resident_last_name} at ${row.resident_street})`)
            } else {
                const resident = residents[0]

                if (resident.hasSigned) {
                    alreadySigned++
                    console.log(`  ⏭️  ID ${externalId}: ${resident.firstName} ${resident.lastName} already signed`)
                } else {
                    // Create consent record
                    await createConsent(resident.id, resident.addressId)

                    // Update resident
                    await updateResidentSigned(resident.id)

                    consentsCreated++
                    console.log(`  ✅ ID ${externalId}: ${resident.firstName} ${resident.lastName} at ${resident.address?.street}`)
                }
            }

            processed++
            if (processed % 50 === 0) {
                console.log(`\n  Progress: ${processed}/${rows.length} processed...\n`)
            }

        } catch (err) {
            console.error(`  ❌ Error processing ID ${externalId}:`, err)
            errors.push(`ID ${externalId}: ${err}`)
        }
    }

    console.log('\n' + '='.repeat(60))
    console.log('=== Upload Complete ===')
    console.log(`Total rows processed: ${processed}`)
    console.log(`Consents created: ${consentsCreated}`)
    console.log(`Already signed: ${alreadySigned}`)
    console.log(`Not found in database: ${notFound}`)
    console.log(`Errors: ${errors.length}`)

    if (errors.length > 0) {
        console.log('\n=== Errors/Not Found (first 20) ===')
        errors.slice(0, 20).forEach(err => console.log(`  - ${err}`))
        if (errors.length > 20) {
            console.log(`  ... and ${errors.length - 20} more`)
        }
    }

    if (consentsCreated > 0) {
        console.log('\n✅ Successfully uploaded consents!')
        console.log('💡 Refresh the canvas page to see updated signatures.')
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
