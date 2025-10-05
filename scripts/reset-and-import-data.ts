// Reset and import addresses and residents from CSV files
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

async function deleteAllData() {
    console.log('=== DELETING EXISTING DATA ===')
    
    // Delete Assignments first (has foreign keys)
    console.log('Deleting assignments...')
    let assignmentNextToken: string | undefined
    let assignmentCount = 0
    do {
        const assignments = await client.models.Assignment.list({ 
            limit: 1000,
            nextToken: assignmentNextToken 
        })
        
        for (const assignment of assignments.data) {
            await client.models.Assignment.delete({ id: assignment.id })
            assignmentCount++
        }
        
        assignmentNextToken = assignments.nextToken
    } while (assignmentNextToken)
    console.log(`  Deleted ${assignmentCount} assignments`)
    
    // Delete InteractionRecords
    console.log('Deleting interaction records...')
    let interactionNextToken: string | undefined
    let interactionCount = 0
    do {
        const interactions = await client.models.InteractionRecord.list({ 
            limit: 1000,
            nextToken: interactionNextToken 
        })
        
        for (const interaction of interactions.data) {
            await client.models.InteractionRecord.delete({ id: interaction.id })
            interactionCount++
        }
        
        interactionNextToken = interactions.nextToken
    } while (interactionNextToken)
    console.log(`  Deleted ${interactionCount} interaction records`)
    
    // Delete Consents
    console.log('Deleting consents...')
    let consentNextToken: string | undefined
    let consentCount = 0
    do {
        const consents = await client.models.Consent.list({ 
            limit: 1000,
            nextToken: consentNextToken 
        })
        
        for (const consent of consents.data) {
            await client.models.Consent.delete({ id: consent.id })
            consentCount++
        }
        
        consentNextToken = consents.nextToken
    } while (consentNextToken)
    console.log(`  Deleted ${consentCount} consents`)
    
    // Delete Residents
    console.log('Deleting residents...')
    let residentNextToken: string | undefined
    let residentCount = 0
    do {
        const residents = await client.models.Resident.list({ 
            limit: 1000,
            nextToken: residentNextToken 
        })
        
        for (const resident of residents.data) {
            await client.models.Resident.delete({ id: resident.id })
            residentCount++
        }
        
        residentNextToken = residents.nextToken
    } while (residentNextToken)
    console.log(`  Deleted ${residentCount} residents`)
    
    // Delete Addresses
    console.log('Deleting addresses...')
    let addressNextToken: string | undefined
    let addressCount = 0
    do {
        const addresses = await client.models.Address.list({ 
            limit: 1000,
            nextToken: addressNextToken 
        })
        
        for (const address of addresses.data) {
            await client.models.Address.delete({ id: address.id })
            addressCount++
        }
        
        addressNextToken = addresses.nextToken
    } while (addressNextToken)
    console.log(`  Deleted ${addressCount} addresses`)
    
    console.log('\n=== ALL DATA DELETED ===\n')
}

async function importAddresses() {
    console.log('=== IMPORTING ADDRESSES ===')
    
    const csvPath = path.resolve('.data/address2.csv')
    const raw = fs.readFileSync(csvPath, 'utf8')
    const records: AddressRow[] = parse(raw, {columns: true, skip_empty_lines: true})
    
    console.log(`Found ${records.length} addresses to import`)
    
    const addressIdMap = new Map<string, string>() // CSV ID -> DynamoDB ID
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
                addressIdMap.set(row.id, result.data.id)
                imported++
                
                if (imported % 100 === 0) {
                    console.log(`  Imported ${imported}/${records.length} addresses...`)
                }
            }
        } catch (error) {
            console.error(`Error importing address ${row.Street}:`, error)
        }
    }
    
    console.log(`  Successfully imported ${imported} addresses`)
    return addressIdMap
}

async function importResidents(addressIdMap: Map<string, string>) {
    console.log('\n=== IMPORTING RESIDENTS ===')
    
    const csvPath = path.resolve('.data/residents2.csv')
    const raw = fs.readFileSync(csvPath, 'utf8')
    const records: ResidentRow[] = parse(raw, {columns: true, skip_empty_lines: true})
    
    console.log(`Found ${records.length} residents to import`)
    
    let imported = 0
    let skipped = 0
    
    for (const row of records) {
        const dynamoAddressId = addressIdMap.get(row.address_id)
        
        if (!dynamoAddressId) {
            console.log(`  Warning: No address found for resident ${row['Occupant First Name']} ${row['Occupant Last Name']} (address_id: ${row.address_id})`)
            skipped++
            continue
        }
        
        try {
            const result = await client.models.Resident.create({
                externalId: row.id,
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
                imported++
                
                if (imported % 100 === 0) {
                    console.log(`  Imported ${imported}/${records.length} residents...`)
                }
            }
        } catch (error) {
            console.error(`Error importing resident ${row['Occupant First Name']} ${row['Occupant Last Name']}:`, error)
        }
    }
    
    console.log(`  Successfully imported ${imported} residents`)
    if (skipped > 0) {
        console.log(`  Skipped ${skipped} residents due to missing addresses`)
    }
}

async function main() {
    try {
        console.log('Starting data reset and import process...\n')
        
        // Step 1: Delete all existing data
        await deleteAllData()
        
        // Step 2: Import addresses
        const addressIdMap = await importAddresses()
        
        // Step 3: Import residents
        await importResidents(addressIdMap)
        
        console.log('\n=== IMPORT COMPLETE ===')
        console.log('Data has been successfully reset and imported from address2.csv and residents2.csv')
        
    } catch (error) {
        console.error('Error during import:', error)
        process.exit(1)
    }
}

main()