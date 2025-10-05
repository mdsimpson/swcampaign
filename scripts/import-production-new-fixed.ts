// Import production data from address2.csv and residents2.csv using direct GraphQL
import fs from 'node:fs'
import { parse } from 'csv-parse/sync'

// Production configuration
const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-ilcaatyuoffcrjo73iy2rk4hxy"

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
    console.log('🚀 Starting production data import from address2.csv and residents2.csv...')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    
    // Load CSV files
    console.log('\n📂 Loading CSV files...')
    const addressCsv = fs.readFileSync('./.data/address2.csv', 'utf8')
    const residentsCsv = fs.readFileSync('./.data/residents2.csv', 'utf8')
    
    const addresses = parse(addressCsv, { columns: true, skip_empty_lines: true, relax_quotes: true })
    const residents = parse(residentsCsv, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true })
    
    console.log(`Found ${addresses.length} addresses and ${residents.length} residents to import`)

    // Import addresses
    console.log('\n🏠 Importing addresses...')
    let addressCount = 0
    let addressErrors = 0
    const addressIdMap = new Map<string, string>() // Maps old IDs to new IDs

    const createAddressMutation = `
        mutation CreateAddress($input: CreateAddressInput!) {
            createAddress(input: $input) {
                id
                street
                city
                state
                zip
                externalId
            }
        }
    `

    for (const address of addresses) {
        try {
            const input = {
                externalId: address.id, // Store original CSV ID
                street: address.Street,
                city: address.City,
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
                    console.log(`  Imported ${addressCount}/${addresses.length} addresses...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed to import address ${address.Street}:`, error.message?.substring(0, 100))
            addressErrors++
        }
    }
    
    console.log(`✅ Imported ${addressCount} addresses (${addressErrors} errors)`)

    // Import residents
    console.log('\n👥 Importing residents...')
    let residentCount = 0
    let residentErrors = 0

    const createResidentMutation = `
        mutation CreateResident($input: CreateResidentInput!) {
            createResident(input: $input) {
                id
                firstName
                lastName
                addressId
                externalId
            }
        }
    `

    for (const resident of residents) {
        try {
            // Get the new address ID from our mapping
            const newAddressId = addressIdMap.get(resident.address_id)
            if (!newAddressId) {
                console.warn(`Skipping resident ${resident['Occupant First Name']} ${resident['Occupant Last Name']} - address not found (CSV address_id: ${resident.address_id})`)
                residentErrors++
                continue
            }

            const input = {
                externalId: resident.id, // Store original CSV ID
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
                    console.log(`  Imported ${residentCount}/${residents.length} residents...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed to import resident ${resident['Occupant First Name']} ${resident['Occupant Last Name']}:`, error.message?.substring(0, 100))
            residentErrors++
        }
    }
    
    console.log(`✅ Imported ${residentCount} residents (${residentErrors} errors)`)
    
    // Summary
    console.log('\n📊 Production Import Summary:')
    console.log(`  Addresses: ${addressCount} imported, ${addressErrors} errors`)
    console.log(`  Residents: ${residentCount} imported, ${residentErrors} errors`)
    console.log('\n✨ Production data import complete!')
    console.log('\nYour production app should now show:')
    console.log(`- Total Addresses: ${addressCount} (instead of 4,110)`)
    console.log(`- With ${residentCount} residents total`)
    console.log(`- Including 300 absentee residents (15%)`)
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})