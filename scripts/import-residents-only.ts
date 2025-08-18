import fs from 'node:fs'
import { parse } from 'csv-parse/sync'

// Production configuration
const GRAPHQL_ENDPOINT = 'https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql'
const API_KEY = 'da2-ilcaatyuoffcrjo73iy2rk4hxy'

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
    console.log('🚀 Starting production RESIDENT import...')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    
    // First, get all addresses to create mapping
    console.log('\n📂 Loading addresses from production...')
    let allAddresses: any[] = []
    let nextToken = null
    
    do {
        const query = `
            query ListAddresses($nextToken: String) {
                listAddresses(limit: 1000, nextToken: $nextToken) {
                    items {
                        id
                        street
                        city
                        state
                        zip
                    }
                    nextToken
                }
            }
        `
        const result = await graphqlRequest(query, { nextToken })
        allAddresses.push(...result.listAddresses.items)
        nextToken = result.listAddresses.nextToken
    } while (nextToken)
    
    console.log(`Loaded ${allAddresses.length} addresses from production`)
    
    // Create mapping from CSV address ID to production address ID
    // We'll map by street address since that's unique
    const addressCsv = fs.readFileSync('./.data/address.csv', 'utf8')
    const csvAddresses = parse(addressCsv, { columns: true, skip_empty_lines: true })
    
    const addressIdMap = new Map<string, string>()
    for (const csvAddr of csvAddresses) {
        const street = csvAddr.Street || csvAddr.street
        // Find matching production address
        const prodAddr = allAddresses.find(a => a.street === street)
        if (prodAddr) {
            addressIdMap.set(csvAddr.id, prodAddr.id)
        }
    }
    
    console.log(`Created mapping for ${addressIdMap.size} addresses`)
    
    // Load residents CSV
    console.log('\n📂 Loading residents CSV...')
    const residentsCsv = fs.readFileSync('./.data/residents.csv', 'utf8')
    const residents = parse(residentsCsv, { columns: true, skip_empty_lines: true })
    
    console.log(`Found ${residents.length} residents to import`)

    // Import residents with correct field names
    console.log('\n👥 Importing residents...')
    let residentCount = 0
    let residentErrors = 0
    let skippedCount = 0

    const createResidentMutation = `
        mutation CreateResident($input: CreateResidentInput!) {
            createResident(input: $input) {
                id
                firstName
                lastName
                addressId
            }
        }
    `

    for (const resident of residents) {
        try {
            // Get the production address ID
            const addressId = resident.address_id || resident.addressId
            const newAddressId = addressIdMap.get(addressId)
            
            if (!newAddressId) {
                skippedCount++
                continue
            }

            // Map CSV columns to production schema fields
            const input = {
                addressId: newAddressId,
                firstName: resident['Occupant First Name'] || resident.firstName,
                lastName: resident['Occupant Last Name'] || resident.lastName,
                occupantType: resident['Occupant Type'] || resident.occupantType || 'Resident',
                contactEmail: resident['Contact Email'] || resident.email || null,
                additionalEmail: resident['Additional Email'] || null,
                cellPhone: resident['Cell Phone'] || resident.phone || null,
                cellPhoneAlert: resident['Cell Phone Resident Alert Emergency'] || null,
                unitPhone: resident['Unit Phone'] || null,
                workPhone: resident['Work Phone'] || null,
                isAbsentee: resident['Is Absentee'] === 'true' || resident['Is Absentee'] === true || false
            }
            
            // Remove null values to avoid GraphQL errors
            Object.keys(input).forEach(key => {
                if (input[key] === null || input[key] === undefined || input[key] === '') {
                    delete input[key]
                }
            })
            
            const result = await graphqlRequest(createResidentMutation, { input })
            
            if (result?.createResident?.id) {
                residentCount++
                if (residentCount % 100 === 0) {
                    console.log(`  Imported ${residentCount} residents...`)
                }
            }
        } catch (error: any) {
            const errorMsg = error.message?.substring(0, 100)
            console.error(`Failed to import resident ${resident['Occupant First Name']} ${resident['Occupant Last Name']}: ${errorMsg}`)
            residentErrors++
        }
    }
    
    console.log(`\n✅ Imported ${residentCount} residents`)
    console.log(`⚠️  Skipped ${skippedCount} residents (address not found)`)
    console.log(`❌ Failed ${residentErrors} residents`)
    
    // Summary
    console.log('\n📊 Import Summary:')
    console.log(`  Total residents processed: ${residents.length}`)
    console.log(`  Successfully imported: ${residentCount}`)
    console.log(`  Skipped (no address): ${skippedCount}`)
    console.log(`  Failed: ${residentErrors}`)
    console.log('\n✨ Resident import complete!')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})