import fs from 'node:fs'
import path from 'node:path'
import {parse} from 'csv-parse/sync'
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>()

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

async function main() {
    const csvPath = process.argv[2] || path.resolve('.data/matched_resident_ids.csv')

    console.log(`Reading consent signatures from: ${csvPath}`)
    const raw = fs.readFileSync(csvPath, 'utf8')
    const records: Row[] = parse(raw, {columns: true, skip_empty_lines: true})

    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    for (const row of records) {
        const residentId = row.id?.trim()
        if (!residentId) {
            console.warn('Skipping row with missing ID')
            skipped++
            continue
        }

        try {
            // Fetch the resident to get their addressId
            const {data: resident} = await client.models.Resident.get({id: residentId})

            if (!resident) {
                console.warn(`Resident ${residentId} not found, skipping`)
                skipped++
                continue
            }

            if (!resident.addressId) {
                console.warn(`Resident ${residentId} has no addressId, skipping`)
                skipped++
                continue
            }

            // Check if consent already exists for this resident
            const {data: existingConsents} = await client.models.Consent.list({
                filter: {residentId: {eq: residentId}}
            })

            if (existingConsents && existingConsents.length > 0) {
                console.log(`Consent already exists for resident ${residentId} (${row.resident_first_name} ${row.resident_last_name}), skipping`)
                skipped++
                continue
            }

            // Create the consent record
            await client.models.Consent.create({
                residentId: residentId,
                addressId: resident.addressId,
                recordedAt: new Date().toISOString(),
                source: 'bulk-upload',
                recordedBy: 'import-script'
            })

            // Update the resident record to mark as signed
            await client.models.Resident.update({
                id: residentId,
                hasSigned: true,
                signedAt: new Date().toISOString()
            })

            created++
            console.log(`✓ Created consent for resident ${residentId} (${row.resident_first_name} ${row.resident_last_name})`)

        } catch (err) {
            console.error(`Error processing resident ${residentId}:`, err)
            errors++
        }
    }

    console.log('\n=== Import Summary ===')
    console.log(`Total rows: ${records.length}`)
    console.log(`Consents created: ${created}`)
    console.log(`Updated residents: ${updated}`)
    console.log(`Skipped: ${skipped}`)
    console.log(`Errors: ${errors}`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
