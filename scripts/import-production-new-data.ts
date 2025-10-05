// Import production data from address2.csv and residents2.csv
import fs from 'node:fs'
import path from 'node:path'
import {parse} from 'csv-parse/sync'
import {Amplify} from 'aws-amplify'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../amplify/data/resource'

// Production configuration - you need to get these from your production Amplify app
const PRODUCTION_CONFIG = {
    API: {
        GraphQL: {
            endpoint: process.env.PROD_GRAPHQL_ENDPOINT!,
            region: 'us-east-1',
            defaultAuthMode: 'apiKey' as const,
            apiKey: process.env.PROD_API_KEY!
        }
    }
}

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
    // Check for required environment variables
    if (!process.env.PROD_GRAPHQL_ENDPOINT || !process.env.PROD_API_KEY) {
        console.error(`
❌ Missing required environment variables!

To get these values:
1. Go to AWS Amplify Console
2. Select your app (swcampaign)
3. Go to the API settings
4. Find your GraphQL endpoint and API key

Then run:
PROD_GRAPHQL_ENDPOINT=https://xxxxx.appsync-api.us-east-1.amazonaws.com/graphql \\
PROD_API_KEY=da2-xxxxxxxxxxxxx \\
tsx scripts/import-production-new-data.ts

`)
        process.exit(1)
    }

    console.log('🚀 Starting production data import from address2.csv and residents2.csv...')
    console.log('GraphQL Endpoint:', process.env.PROD_GRAPHQL_ENDPOINT)
    
    // Configure Amplify with production settings
    Amplify.configure(PRODUCTION_CONFIG)
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    // Load CSV files
    console.log('\n📂 Loading CSV files...')
    const addressCsv = fs.readFileSync('./.data/address2.csv', 'utf8')
    const residentsCsv = fs.readFileSync('./.data/residents2.csv', 'utf8')
    
    const addresses: AddressRow[] = parse(addressCsv, { columns: true, skip_empty_lines: true })
    const residents: ResidentRow[] = parse(residentsCsv, { columns: true, skip_empty_lines: true })
    
    console.log(`Found ${addresses.length} addresses and ${residents.length} residents to import`)

    // Import addresses
    console.log('\n🏠 Importing addresses...')
    let addressCount = 0
    let addressErrors = 0
    const addressIdMap = new Map<string, string>() // Maps CSV IDs to DynamoDB IDs

    for (const address of addresses) {
        try {
            const result = await client.models.Address.create({
                externalId: address.id, // Store original CSV ID
                street: address.Street,
                city: address.City,
                state: address.State || 'VA',
                zip: address.Zip,
                lat: address.lat ? parseFloat(address.lat) : undefined,
                lng: address.lng ? parseFloat(address.lng) : undefined,
            })
            
            if (result.data?.id) {
                addressIdMap.set(address.id, result.data.id)
                addressCount++
                if (addressCount % 100 === 0) {
                    console.log(`  Imported ${addressCount}/${addresses.length} addresses...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed to import address ${address.Street}:`, error.message)
            addressErrors++
        }
    }
    
    console.log(`✅ Imported ${addressCount} addresses (${addressErrors} errors)`)

    // Import residents
    console.log('\n👥 Importing residents...')
    let residentCount = 0
    let residentErrors = 0

    for (const resident of residents) {
        try {
            // Get the new address ID from our mapping
            const newAddressId = addressIdMap.get(resident.address_id)
            if (!newAddressId) {
                console.warn(`Skipping resident ${resident['Occupant First Name']} ${resident['Occupant Last Name']} - address not found (CSV address_id: ${resident.address_id})`)
                residentErrors++
                continue
            }

            const result = await client.models.Resident.create({
                externalId: resident.id, // Store original CSV ID
                addressId: newAddressId,
                firstName: resident['Occupant First Name'] || undefined,
                lastName: resident['Occupant Last Name'] || undefined,
                occupantType: resident['Occupant Type'] || undefined,
                contactEmail: resident['Contact Email'] || undefined,
                additionalEmail: resident['Additional Email'] || undefined,
                cellPhone: resident['Cell Phone'] || undefined,
                cellPhoneAlert: resident['Cell Phone Resident Alert Emergency'] || undefined,
                unitPhone: resident['Unit Phone'] || undefined,
                workPhone: resident['Work Phone'] || undefined,
                isAbsentee: resident['Is Absentee'] === 'true',
                hasSigned: false,
            })
            
            if (result.data?.id) {
                residentCount++
                if (residentCount % 100 === 0) {
                    console.log(`  Imported ${residentCount}/${residents.length} residents...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed to import resident ${resident['Occupant First Name']} ${resident['Occupant Last Name']}:`, error.message)
            residentErrors++
        }
    }
    
    console.log(`✅ Imported ${residentCount} residents (${residentErrors} errors)`)
    
    // Summary
    console.log('\n📊 Production Import Summary:')
    console.log(`  Addresses: ${addressCount} imported, ${addressErrors} errors`)
    console.log(`  Residents: ${residentCount} imported, ${residentErrors} errors`)
    console.log('\n✨ Production data import complete!')
    console.log('\nNext steps:')
    console.log('- Verify data in your production app')
    console.log('- Check that Total Addresses shows the correct count (1,112)')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})