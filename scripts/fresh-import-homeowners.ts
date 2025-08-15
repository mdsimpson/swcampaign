// Fresh import homeowners CSV into Amplify Data (Homes + Persons)
// Does not check for existing records - use for clean database
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

async function main() {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Usage: npm run fresh-import -- /path/to/Homeowners.csv');
        process.exit(1)
    }
    const raw = fs.readFileSync(path.resolve(csvPath), 'utf8')
    const records: Row[] = parse(raw, {columns: true, skip_empty_lines: true})
    
    console.log(`CSV contains ${records.length} total records`)
    
    // Group records by address since CSV has one row per person
    const homeMap = new Map<string, {home: any, people: any[]}>()
    
    for (const row of records) {
        const street = row['Street'] || ''
        if (!street) continue
        
        const city = row['City'] || 'Ashburn'
        const state = row['State'] || 'VA'
        const postalCode = row['Zip'] || undefined
        const mailingStreet = row['Billing Address Street'] || undefined
        const mailingCity = row['Billing Address City'] || undefined
        const mailingState = row['Billing Address State'] || undefined
        const mailingPostalCode = row['Billing Address Zip Code'] || undefined
        const absenteeOwner = Boolean(mailingStreet && mailingStreet.trim() && (mailingStreet !== street))
        
        const homeKey = `${street}|${city}|${state}`
        
        if (!homeMap.has(homeKey)) {
            homeMap.set(homeKey, {
                home: {
                    street,
                    city,
                    state,
                    postalCode,
                    unitNumber: undefined,
                    mailingStreet,
                    mailingCity,
                    mailingState,
                    mailingPostalCode,
                    absenteeOwner
                },
                people: []
            })
        }
        
        // Add person to this home
        const firstName = row['Occupant First Name']
        const lastName = row['Occupant Last Name']
        const occupantType = row['Occupant Type']
        
        if (firstName || lastName) {
            let role: 'PRIMARY_OWNER' | 'SECONDARY_OWNER' | 'RENTER' | 'OTHER'
            
            if (occupantType === 'Official Owner') {
                role = 'PRIMARY_OWNER'
            } else if (occupantType === 'Official Co Owner') {
                role = 'SECONDARY_OWNER'
            } else if (occupantType && occupantType.toLowerCase().includes('renter')) {
                role = 'RENTER'
            } else {
                role = 'OTHER'
            }
            
            homeMap.get(homeKey)?.people.push({
                role,
                firstName,
                lastName,
                email: row['Contact Email'] || row['Additional Email'] || undefined,
                mobilePhone: normalizePhone(row['Cell Phone'] || row['Unit Phone'] || row['Work Phone'])
            })
        }
    }
    
    let homes = 0, persons = 0
    const homeEntries = Array.from(homeMap.values())
    const batchSize = 200
    
    console.log(`Processing ${homeEntries.length} unique homes in batches of ${batchSize}`)
    
    // Create homes and their residents in batches
    for (let i = 0; i < homeEntries.length; i += batchSize) {
        const batch = homeEntries.slice(i, i + batchSize)
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(homeEntries.length/batchSize)} (${batch.length} homes)`)
        
        for (const {home, people} of batch) {
            try {
                const {data: homeRecord} = await client.models.Home.create(home)
                if (!homeRecord) {
                    console.error('Failed to create home:', home.street)
                    continue
                }
                homes++
                
                // Create all people for this home
                for (const person of people) {
                    await client.models.Person.create({
                        homeId: homeRecord.id,
                        ...person
                    } as any);
                    persons++
                }
            } catch (error) {
                console.error('Failed to process home:', home.street, error)
            }
        }
        
        console.log(`Batch ${Math.floor(i/batchSize) + 1} complete. Running totals: ${homes} homes, ${persons} people`)
    }
    
    console.log(`Import completed. Final totals: ${homes} homes and ${persons} people.`)
}

main().catch(err => {
    console.error(err);
    process.exit(1)
})