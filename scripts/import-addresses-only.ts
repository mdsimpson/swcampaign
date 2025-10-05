// Import addresses only from address2.csv
import fs from 'node:fs'
import path from 'node:path'
import {parse} from 'csv-parse/sync'
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>({
    authMode: 'apiKey'
})

type AddressRow = {
    id: string
    Street: string
    City: string
    State: string
    Zip: string
    lat: string
    lng: string
}

async function main() {
    try {
        console.log('=== IMPORTING ADDRESSES FROM address2.csv ===')
        
        const csvPath = path.resolve('.data/address2.csv')
        const raw = fs.readFileSync(csvPath, 'utf8')
        const records: AddressRow[] = parse(raw, {columns: true, skip_empty_lines: true})
        
        console.log(`Found ${records.length} addresses to import`)
        
        let imported = 0
        
        for (const row of records) {
            try {
                const result = await client.models.Address.create({
                    externalId: row.id,
                    street: row.Street,
                    city: row.City,
                    state: row.State || 'VA',
                    zip: row.Zip,
                    lat: row.lat ? parseFloat(row.lat) : undefined,
                    lng: row.lng ? parseFloat(row.lng) : undefined,
                })
                
                if (result.data) {
                    imported++
                    
                    if (imported % 100 === 0) {
                        console.log(`  Imported ${imported}/${records.length} addresses...`)
                    }
                }
            } catch (error) {
                console.error(`Error importing address ${row.Street}:`, error)
            }
        }
        
        console.log(`\n✓ Successfully imported ${imported} addresses`)
        
    } catch (error) {
        console.error('Error during import:', error)
        process.exit(1)
    }
}

main()