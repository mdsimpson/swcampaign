// Import addresses and residents to production from CSV files
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ilcaatyuoffcrjo73iy2rk4hxy"

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
    person_id: string
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

async function createAddress(row: AddressRow) {
    const mutation = `
        mutation CreateAddress($input: CreateAddressInput!) {
            createAddress(input: $input) {
                id
                externalId
                street
            }
        }
    `

    const data = await graphqlRequest(mutation, {
        input: {
            externalId: row.id,
            street: row.Street,
            city: row.City,
            state: row.State,
            zip: row.Zip,
            lat: row.lat ? parseFloat(row.lat) : null,
            lng: row.lng ? parseFloat(row.lng) : null
        }
    })
    return data.createAddress
}

async function createResident(row: ResidentRow, addressIdMap: Map<string, string>) {
    const mutation = `
        mutation CreateResident($input: CreateResidentInput!) {
            createResident(input: $input) {
                id
                personId
                firstName
                lastName
            }
        }
    `

    const addressDbId = addressIdMap.get(row.address_id)
    if (!addressDbId) {
        throw new Error(`Address ID ${row.address_id} not found in map`)
    }

    const isAbsentee = row['Is Absentee']?.toLowerCase() === 'true'

    const data = await graphqlRequest(mutation, {
        input: {
            personId: row.person_id,
            addressId: addressDbId,
            firstName: row['Occupant First Name'] || null,
            lastName: row['Occupant Last Name'] || null,
            occupantType: row['Occupant Type'] || null,
            contactEmail: row['Contact Email'] || null,
            additionalEmail: row['Additional Email'] || null,
            cellPhone: row['Cell Phone'] || null,
            cellPhoneAlert: row['Cell Phone Resident Alert Emergency'] || null,
            unitPhone: row['Unit Phone'] || null,
            workPhone: row['Work Phone'] || null,
            isAbsentee: isAbsentee
        }
    })
    return data.createResident
}

async function main() {
    console.log('🚀 Starting production data import from CSV files...')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    console.log()

    // Load CSV files
    console.log('📂 Loading CSV files...')
    const addressCsv = fs.readFileSync('./.data/address2.csv', 'utf8')
    const residentsCsv = fs.readFileSync('./.data/residents2.csv', 'utf8')

    const addresses: AddressRow[] = parse(addressCsv, {
        columns: true,
        skip_empty_lines: true
    })
    const residents: ResidentRow[] = parse(residentsCsv, {
        columns: true,
        skip_empty_lines: true
    })

    console.log(`Found ${addresses.length} addresses and ${residents.length} residents to import\n`)

    // Import addresses
    console.log('🏠 Importing addresses...')
    let addressCount = 0
    let addressErrors = 0
    const addressIdMap = new Map<string, string>() // Maps CSV address_id to database ID

    for (const row of addresses) {
        try {
            const address = await createAddress(row)
            addressIdMap.set(row.id, address.id)
            addressCount++
            if (addressCount % 100 === 0) {
                console.log(`  Imported ${addressCount}/${addresses.length} addresses...`)
            }
        } catch (err) {
            console.error(`  Error importing address ${row.Street}:`, err)
            addressErrors++
        }
    }

    console.log(`✅ Imported ${addressCount} addresses (${addressErrors} errors)\n`)

    // Import residents
    console.log('👥 Importing residents...')
    let residentCount = 0
    let residentErrors = 0

    for (const row of residents) {
        try {
            await createResident(row, addressIdMap)
            residentCount++
            if (residentCount % 100 === 0) {
                console.log(`  Imported ${residentCount}/${residents.length} residents...`)
            }
        } catch (err) {
            console.error(`  Error importing resident ${row['Occupant First Name']} ${row['Occupant Last Name']}:`, err)
            residentErrors++
        }
    }

    console.log(`✅ Imported ${residentCount} residents (${residentErrors} errors)\n`)

    // Summary
    console.log('=== Import Complete ===')
    console.log(`Addresses: ${addressCount} imported, ${addressErrors} errors`)
    console.log(`Residents: ${residentCount} imported, ${residentErrors} errors`)

    if (addressErrors === 0 && residentErrors === 0) {
        console.log('\n🎉 All data successfully imported to production!')
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
