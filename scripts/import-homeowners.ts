// Import homeowners CSV into Amplify Data (Homes + Persons)
import fs from 'node:fs'
import path from 'node:path'
import {parse} from 'csv-parse/sync'
import {Amplify} from 'aws-amplify'
import outputs from '../amplify_outputs.json' assert {type: 'json'}
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

Amplify.configure(outputs)
const client = generateClient<Schema>()
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
        console.error('Usage: npm run import:homeowners -- /path/to/Homeowners.csv');
        process.exit(1)
    }
    const raw = fs.readFileSync(path.resolve(csvPath), 'utf8')
    const records: Row[] = parse(raw, {columns: true, skip_empty_lines: true})
    let homes = 0, persons = 0
    for (const row of records) {
        const street = row['Property Address'] || row['Unit Address'] || row['Street Address'] || row['Unit Street'] || row['Address'] || ''
        if (!street) continue
        const city = row['City'] || 'Ashburn'
        const state = row['State'] || 'VA'
        const postalCode = row['Zip'] || row['Postal Code'] || row['ZIP'] || undefined
        const unitNumber = row['Unit Number'] || row['Unit'] || undefined
        const mailingStreet = row['Mailing Street'] || row['Billing Street'] || undefined
        const mailingCity = row['Mailing City'] || row['Billing City'] || undefined
        const mailingState = row['Mailing State'] || row['Billing State'] || undefined
        const mailingPostalCode = row['Mailing Zip'] || row['Billing Zip'] || undefined
        const absenteeOwner = Boolean(mailingStreet && mailingStreet.trim() && (mailingStreet !== street))
        const {data: home} = await client.models.Home.create({
            street,
            city,
            state,
            postalCode,
            unitNumber,
            mailingStreet,
            mailingCity,
            mailingState,
            mailingPostalCode,
            absenteeOwner
        })
        homes++
        const p1f = row['Owner First Name'] || row['Primary Owner First Name'] || row['Occupant First Name']
        const p1l = row['Owner Last Name'] || row['Primary Owner Last Name'] || row['Occupant Last Name']
        if (p1f || p1l) {
            await client.models.Person.create({
                homeId: home.id,
                role: 'PRIMARY_OWNER',
                firstName: p1f,
                lastName: p1l,
                email: row['Owner Email'] || row['Email'] || undefined,
                mobilePhone: normalizePhone(row['Cell Phone'] || row['Mobile Phone'] || row['Unit Phone'])
            } as any);
            persons++
        }
        const p2f = row['Secondary Owner First Name'] || row['Co-Owner First Name']
        const p2l = row['Secondary Owner Last Name'] || row['Co-Owner Last Name']
        if (p2f || p2l) {
            await client.models.Person.create({
                homeId: home.id,
                role: 'SECONDARY_OWNER',
                firstName: p2f,
                lastName: p2l,
                email: row['Secondary Email'] || undefined,
                mobilePhone: normalizePhone(row['Secondary Cell'] || undefined)
            } as any);
            persons++
        }
        const rf = row['Renter First Name'] || row['Tenant First Name']
        const rl = row['Renter Last Name'] || row['Tenant Last Name']
        if (rf || rl) {
            await client.models.Person.create({
                homeId: home.id,
                role: 'RENTER',
                firstName: rf,
                lastName: rl,
                email: row['Renter Email'] || undefined,
                mobilePhone: normalizePhone(row['Renter Cell'] || undefined)
            } as any);
            persons++
        }
    }
    console.log(`Imported ${homes} homes and ${persons} people.`)
}

main().catch(err => {
    console.error(err);
    process.exit(1)
})
