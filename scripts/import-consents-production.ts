// Import consent signatures to production using direct GraphQL
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'

// Production configuration
const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ilcaatyuoffcrjo73iy2rk4hxy"

type Row = {
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

async function getResidentByExternalId(externalId: string) {
    const query = `
        query ListResidents($filter: ModelResidentFilterInput) {
            listResidents(filter: $filter) {
                items {
                    id
                    externalId
                    addressId
                    firstName
                    lastName
                    hasSigned
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { externalId: { eq: externalId } }
    })
    return data.listResidents.items.length > 0 ? data.listResidents.items[0] : null
}

async function listConsentsByResident(residentId: string) {
    const query = `
        query ListConsents($filter: ModelConsentFilterInput) {
            listConsents(filter: $filter) {
                items {
                    id
                    residentId
                }
            }
        }
    `
    const data = await graphqlRequest(query, {
        filter: { residentId: { eq: residentId } }
    })
    return data.listConsents.items
}

async function createConsent(residentId: string, addressId: string) {
    const mutation = `
        mutation CreateConsent($input: CreateConsentInput!) {
            createConsent(input: $input) {
                id
                residentId
                addressId
                recordedAt
                source
            }
        }
    `
    const data = await graphqlRequest(mutation, {
        input: {
            residentId,
            addressId,
            recordedAt: new Date().toISOString(),
            source: 'bulk-upload',
            recordedBy: 'import-script'
        }
    })
    return data.createConsent
}

async function updateResident(id: string) {
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
            id,
            hasSigned: true,
            signedAt: new Date().toISOString()
        }
    })
    return data.updateResident
}

async function main() {
    const csvPath = process.argv[2] || './.data/matched_resident_ids.csv'

    console.log('🚀 Starting production consent import...')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    console.log(`Reading from: ${csvPath}\n`)

    const raw = fs.readFileSync(csvPath, 'utf8')
    const records: Row[] = parse(raw, {columns: true, skip_empty_lines: true})

    let created = 0
    let skipped = 0
    let errors = 0

    for (const row of records) {
        const residentId = row.id?.trim()
        if (!residentId) {
            console.warn('⚠️  Skipping row with missing ID')
            skipped++
            continue
        }

        try {
            // Fetch the resident by externalId to get their database ID and addressId
            const resident = await getResidentByExternalId(residentId)

            if (!resident) {
                console.warn(`⚠️  Resident with externalId ${residentId} not found, skipping`)
                skipped++
                continue
            }

            if (!resident.addressId) {
                console.warn(`⚠️  Resident ${residentId} has no addressId, skipping`)
                skipped++
                continue
            }

            // Check if consent already exists for this resident (use database ID)
            const existingConsents = await listConsentsByResident(resident.id)

            if (existingConsents && existingConsents.length > 0) {
                console.log(`ℹ️  Consent already exists for resident externalId ${residentId} (${row.resident_first_name} ${row.resident_last_name}), skipping`)
                skipped++
                continue
            }

            // Create the consent record (use database ID, not externalId)
            await createConsent(resident.id, resident.addressId)

            // Update the resident record to mark as signed (use database ID, not externalId)
            await updateResident(resident.id)

            created++
            console.log(`✅ Created consent for resident externalId ${residentId} (DB ID: ${resident.id}) - ${row.resident_first_name} ${row.resident_last_name}`)

        } catch (err) {
            console.error(`❌ Error processing resident ${residentId}:`, err)
            errors++
        }
    }

    console.log('\n=== Production Import Summary ===')
    console.log(`Total rows: ${records.length}`)
    console.log(`Consents created: ${created}`)
    console.log(`Skipped: ${skipped}`)
    console.log(`Errors: ${errors}`)

    if (created > 0) {
        console.log(`\n🎉 Successfully imported ${created} consent signatures to production!`)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
