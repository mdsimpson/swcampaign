// Safe import homeowners CSV - checks for existing records before importing
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
type Row = Record<string, string>

function normalizePhone(s?: string) {
    if (!s) return undefined;
    const d = s.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return s.trim()
}

async function getAllExistingHomes() {
    console.log('Loading existing homes from database...')
    const existingHomes = new Map<string, string>() // address -> homeId
    let nextToken = null
    let count = 0
    
    do {
        const result = await client.models.Home.list({
            limit: 1000,
            nextToken
        })
        
        for (const home of result.data) {
            const address = `${home.street?.toLowerCase().trim()}, ${home.city?.toLowerCase().trim()}`
            existingHomes.set(address, home.id)
            count++
        }
        
        nextToken = result.nextToken
    } while (nextToken)
    
    console.log(`Found ${count} existing homes in database`)
    return existingHomes
}

async function main() {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Usage: npm run safe-import -- /path/to/Homeowners.csv');
        process.exit(1)
    }
    const raw = fs.readFileSync(path.resolve(csvPath), 'utf8')
    const records: Row[] = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '|'
    });

    console.log(`CSV contains ${records.length} total records`)

    // Get existing homes to avoid duplicates
    const existingHomes = await getAllExistingHomes()

    // Group records by address to create unique homes
    const homeGroups = new Map<string, Row[]>()
    
    for (const record of records) {
        const street = record['Property Street'] || record.street;
        const city = record['Property City'] || record.city;
        
        if (!street || !city) {
            console.warn('Skipping record with missing address:', {street, city})
            continue
        }
        
        const address = `${street.toLowerCase().trim()}, ${city.toLowerCase().trim()}`
        
        if (!homeGroups.has(address)) {
            homeGroups.set(address, [])
        }
        homeGroups.get(address)!.push(record)
    }

    const uniqueAddresses = Array.from(homeGroups.keys())
    console.log(`Processing ${uniqueAddresses.length} unique homes`)

    let homesCreated = 0
    let homesSkipped = 0
    let peopleCreated = 0
    let peopleSkipped = 0
    
    // Process in batches
    const batchSize = 200
    for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
        const batch = uniqueAddresses.slice(i, i + batchSize)
        console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueAddresses.length / batchSize)} (${batch.length} homes)`)

        for (const address of batch) {
            const records = homeGroups.get(address)!
            const firstRecord = records[0]
            
            // Check if home already exists
            let homeId = existingHomes.get(address)
            
            if (homeId) {
                console.log(`Skipping existing home: ${address}`)
                homesSkipped++
            } else {
                // Create new home
                try {
                    const homeResult = await client.models.Home.create({
                        street: firstRecord['Property Street'] || firstRecord.street,
                        city: firstRecord['Property City'] || firstRecord.city,
                        state: firstRecord['Property State'] || firstRecord.state || 'VA',
                        postalCode: firstRecord['Property Zip'] || firstRecord.postalCode,
                        mailingStreet: firstRecord['Mailing Street'] || firstRecord.mailingStreet,
                        mailingCity: firstRecord['Mailing City'] || firstRecord.mailingCity,
                        mailingState: firstRecord['Mailing State'] || firstRecord.mailingState,
                        mailingPostalCode: firstRecord['Mailing Zip'] || firstRecord.mailingPostalCode,
                        absenteeOwner: (firstRecord['Property Street'] !== firstRecord['Mailing Street']) || 
                                      (firstRecord['Property City'] !== firstRecord['Mailing City'])
                    })
                    
                    if (homeResult.data) {
                        homeId = homeResult.data.id
                        existingHomes.set(address, homeId) // Add to cache
                        homesCreated++
                    } else {
                        console.error('Failed to create home:', homeResult.errors)
                        continue
                    }
                } catch (error) {
                    console.error(`Failed to create home for ${address}:`, error)
                    continue
                }
            }

            // Process people for this home
            for (const record of records) {
                // Check if person already exists at this home
                const firstName = record['First Name'] || record.firstName
                const lastName = record['Last Name'] || record.lastName
                
                if (!firstName || !lastName) {
                    console.warn('Skipping person with missing name:', {firstName, lastName})
                    continue
                }
                
                // Get existing people for this home
                try {
                    const existingPeopleResult = await client.models.Person.list({
                        filter: { homeId: { eq: homeId } }
                    })
                    
                    const existingPerson = existingPeopleResult.data.find(p => 
                        p.firstName === firstName && p.lastName === lastName
                    )
                    
                    if (existingPerson) {
                        peopleSkipped++
                        continue
                    }
                    
                    // Create new person
                    const personRole = record['Owner Type'] === 'Official Co Owner' ? 'SECONDARY_OWNER' : 'PRIMARY_OWNER'
                    
                    await client.models.Person.create({
                        homeId: homeId,
                        firstName,
                        lastName,
                        email: record['Email'] || record.email,
                        mobilePhone: normalizePhone(record['Mobile Phone'] || record.mobilePhone),
                        role: personRole,
                        hasSigned: false
                    })
                    
                    peopleCreated++
                } catch (error) {
                    console.error(`Failed to create person ${firstName} ${lastName}:`, error)
                }
            }
        }
        
        console.log(`Batch complete. Running totals: ${homesCreated} homes created, ${homesSkipped} homes skipped, ${peopleCreated} people created, ${peopleSkipped} people skipped`)
    }

    console.log(`\n=== SAFE IMPORT COMPLETE ===`)
    console.log(`Homes created: ${homesCreated}`)
    console.log(`Homes skipped (already existed): ${homesSkipped}`) 
    console.log(`People created: ${peopleCreated}`)
    console.log(`People skipped (already existed): ${peopleSkipped}`)
    console.log(`Final totals: ${homesCreated + homesSkipped} homes, ${peopleCreated + peopleSkipped} people`)
}

main().catch(console.error)