// Import fresh data from address2.csv and residents2.csv
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
    'Contact Email': string
    'Additional Email': string
    'Cell Phone': string
    'Cell Phone Resident Alert Emergency': string
    'Unit Phone': string
    'Work Phone': string
    'Is Absentee': string
}

async function main() {
    try {
        console.log('=== IMPORTING FRESH DATA ===')
        
        // First, delete only addresses with externalId (our new data marker)
        console.log('Cleaning up any existing fresh data...')
        let cleanupCount = 0
        
        // Clean up residents first
        let residentNextToken: string | undefined
        do {
            const residents = await client.models.Resident.list({ 
                limit: 1000,
                nextToken: residentNextToken,
                filter: { externalId: { attributeExists: true } }
            })
            
            for (const resident of residents.data) {
                await client.models.Resident.delete({ id: resident.id })
                cleanupCount++
            }
            
            residentNextToken = residents.nextToken
        } while (residentNextToken)
        
        // Clean up addresses
        let addressNextToken: string | undefined
        do {
            const addresses = await client.models.Address.list({ 
                limit: 1000,
                nextToken: addressNextToken,
                filter: { externalId: { attributeExists: true } }
            })
            
            for (const address of addresses.data) {
                await client.models.Address.delete({ id: address.id })
                cleanupCount++
            }
            
            addressNextToken = addresses.nextToken
        } while (addressNextToken)
        
        console.log(`Cleaned up ${cleanupCount} existing fresh records`)
        
        // Import addresses
        console.log('\n=== IMPORTING ADDRESSES ===')
        
        const addressCsvPath = path.resolve('.data/address2.csv')
        const addressRaw = fs.readFileSync(addressCsvPath, 'utf8')
        const addressRecords: AddressRow[] = parse(addressRaw, {columns: true, skip_empty_lines: true})
        
        console.log(`Found ${addressRecords.length} addresses to import`)
        
        const addressIdMap = new Map<string, string>() // CSV ID -> DynamoDB ID
        let addressesImported = 0
        
        for (const row of addressRecords) {
            try {
                const result = await client.models.Address.create({
                    externalId: `fresh_${row.id}`, // Mark as fresh data
                    street: row.Street,
                    city: row.City,
                    state: row.State || 'VA',
                    zip: row.Zip,
                    lat: row.lat ? parseFloat(row.lat) : undefined,
                    lng: row.lng ? parseFloat(row.lng) : undefined,
                    notes: 'Fresh import from address2.csv'
                })
                
                if (result.data) {
                    addressIdMap.set(row.id, result.data.id)
                    addressesImported++
                    
                    if (addressesImported % 100 === 0) {
                        console.log(`  Imported ${addressesImported}/${addressRecords.length} addresses...`)
                    }
                }
            } catch (error) {
                console.error(`Error importing address ${row.Street}:`, error)
            }
        }
        
        console.log(`  Successfully imported ${addressesImported} addresses`)
        
        // Import residents
        console.log('\n=== IMPORTING RESIDENTS ===')
        
        const residentCsvPath = path.resolve('.data/residents2.csv')
        const residentRaw = fs.readFileSync(residentCsvPath, 'utf8')
        const residentRecords: ResidentRow[] = parse(residentRaw, {columns: true, skip_empty_lines: true})
        
        console.log(`Found ${residentRecords.length} residents to import`)
        
        let residentsImported = 0
        let skipped = 0
        
        for (const row of residentRecords) {
            const dynamoAddressId = addressIdMap.get(row.address_id)
            
            if (!dynamoAddressId) {
                console.log(`  Warning: No address found for resident ${row['Occupant First Name']} ${row['Occupant Last Name']} (address_id: ${row.address_id})`)
                skipped++
                continue
            }
            
            try {
                const result = await client.models.Resident.create({
                    externalId: `fresh_${row.id}`, // Mark as fresh data
                    addressId: dynamoAddressId,
                    firstName: row['Occupant First Name'] || undefined,
                    lastName: row['Occupant Last Name'] || undefined,
                    occupantType: row['Occupant Type'] || undefined,
                    contactEmail: row['Contact Email'] || undefined,
                    additionalEmail: row['Additional Email'] || undefined,
                    cellPhone: row['Cell Phone'] || undefined,
                    cellPhoneAlert: row['Cell Phone Resident Alert Emergency'] || undefined,
                    unitPhone: row['Unit Phone'] || undefined,
                    workPhone: row['Work Phone'] || undefined,
                    isAbsentee: row['Is Absentee'] === 'true',
                    hasSigned: false,
                })
                
                if (result.data) {
                    residentsImported++
                    
                    if (residentsImported % 100 === 0) {
                        console.log(`  Imported ${residentsImported}/${residentRecords.length} residents...`)
                    }
                }
            } catch (error) {
                console.error(`Error importing resident ${row['Occupant First Name']} ${row['Occupant Last Name']}:`, error)
            }
        }
        
        console.log(`  Successfully imported ${residentsImported} residents`)
        if (skipped > 0) {
            console.log(`  Skipped ${skipped} residents due to missing addresses`)
        }
        
        console.log('\n=== FRESH IMPORT COMPLETE ===')
        console.log(`Imported ${addressesImported} addresses and ${residentsImported} residents`)
        console.log('These records are marked with externalId prefix "fresh_" to distinguish from old data')
        
    } catch (error) {
        console.error('Error during import:', error)
        process.exit(1)
    }
}

main()