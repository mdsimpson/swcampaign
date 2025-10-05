// Import data into CURRENT production environment
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import fetch from 'node-fetch'

// Current production endpoint (from amplify_outputs.json)
const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-mgxvgdjuffbvpcz4gljvulnw4m"

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

async function main() {
    console.log('🚀 Importing to CURRENT production environment...')
    console.log('Endpoint:', GRAPHQL_ENDPOINT)
    console.log('')

    // Load CSV files
    console.log('📂 Loading CSV files...')
    const addressCsv = fs.readFileSync('./.data/address2.csv', 'utf8')
    const residentsCsv = fs.readFileSync('./.data/residents2.csv', 'utf8')

    const addresses = parse(addressCsv, { columns: true, skip_empty_lines: true })
    const residents = parse(residentsCsv, { columns: true, skip_empty_lines: true })

    console.log(`Found ${addresses.length} addresses and ${residents.length} residents`)
    console.log('')

    // Import addresses
    console.log('🏠 Importing addresses...')
    let addressCount = 0
    let addressErrors = 0
    const addressIdMap = new Map<string, string>()

    const createAddressMutation = `
        mutation CreateAddress($input: CreateAddressInput!) {
            createAddress(input: $input) {
                id
                street
                externalId
            }
        }
    `

    for (const address of addresses) {
        try {
            const input = {
                externalId: address.id,
                street: address.Street,
                city: address.City || 'Ashburn',
                state: address.State || 'VA',
                zip: address.Zip,
                lat: address.lat ? parseFloat(address.lat) : null,
                lng: address.lng ? parseFloat(address.lng) : null
            }

            const result = await graphqlRequest(createAddressMutation, { input })

            if (result?.createAddress?.id) {
                addressIdMap.set(address.id, result.createAddress.id)
                addressCount++
                if (addressCount % 100 === 0) {
                    console.log(`  ${addressCount}/${addresses.length} addresses...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed: ${address.Street}:`, error.message?.substring(0, 100))
            addressErrors++
        }
    }

    console.log(`✅ ${addressCount} addresses imported (${addressErrors} errors)`)
    console.log('')

    // Import residents
    console.log('👥 Importing residents...')
    let residentCount = 0
    let residentErrors = 0

    const createResidentMutation = `
        mutation CreateResident($input: CreateResidentInput!) {
            createResident(input: $input) {
                id
                firstName
                lastName
                externalId
            }
        }
    `

    for (const resident of residents) {
        try {
            const newAddressId = addressIdMap.get(resident.address_id)
            if (!newAddressId) {
                console.warn(`Skipping ${resident['Occupant First Name']} ${resident['Occupant Last Name']} - address not found`)
                residentErrors++
                continue
            }

            const input = {
                externalId: resident.person_id,
                addressId: newAddressId,
                firstName: resident['Occupant First Name'] || null,
                lastName: resident['Occupant Last Name'] || null,
                occupantType: resident['Occupant Type'] || null,
                contactEmail: resident['Contact Email'] || null,
                additionalEmail: resident['Additional Email'] || null,
                cellPhone: resident['Cell Phone'] || null,
                cellPhoneAlert: resident['Cell Phone Resident Alert Emergency'] || null,
                unitPhone: resident['Unit Phone'] || null,
                workPhone: resident['Work Phone'] || null,
                isAbsentee: resident['Is Absentee'] === 'true',
                hasSigned: false
            }

            const result = await graphqlRequest(createResidentMutation, { input })

            if (result?.createResident?.id) {
                residentCount++
                if (residentCount % 100 === 0) {
                    console.log(`  ${residentCount}/${residents.length} residents...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed: ${resident['Occupant First Name']} ${resident['Occupant Last Name']}:`, error.message?.substring(0, 100))
            residentErrors++
        }
    }

    console.log(`✅ ${residentCount} residents imported (${residentErrors} errors)`)
    console.log('')

    // Summary
    console.log('='.repeat(60))
    console.log('=== Import Complete ===')
    console.log(`Addresses: ${addressCount} imported, ${addressErrors} errors`)
    console.log(`Residents: ${residentCount} imported, ${residentErrors} errors`)
    console.log('')
    console.log('✅ Data imported to CURRENT production environment!')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
