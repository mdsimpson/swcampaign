import fs from 'node:fs'
import { parse } from 'csv-parse/sync'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'

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
npm run import:production

`)
        process.exit(1)
    }

    console.log('🚀 Starting production data import...')
    console.log('GraphQL Endpoint:', process.env.PROD_GRAPHQL_ENDPOINT)
    
    // Configure Amplify with production settings
    Amplify.configure(PRODUCTION_CONFIG)
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    // Load CSV files
    console.log('\n📂 Loading CSV files...')
    const addressCsv = fs.readFileSync('./.data/address.csv', 'utf8')
    const residentsCsv = fs.readFileSync('./.data/residents.csv', 'utf8')
    
    const addresses = parse(addressCsv, { columns: true, skip_empty_lines: true })
    const residents = parse(residentsCsv, { columns: true, skip_empty_lines: true })
    
    console.log(`Found ${addresses.length} addresses and ${residents.length} residents to import`)

    // Import addresses
    console.log('\n🏠 Importing addresses...')
    let addressCount = 0
    let addressErrors = 0
    const addressIdMap = new Map<string, string>() // Maps old IDs to new IDs

    for (const address of addresses) {
        try {
            const result = await client.models.Address.create({
                street: address.street,
                city: address.city || 'Broadlands',
                state: address.state || 'VA',
                zip: address.zip || '20148',
                lat: address.lat ? parseFloat(address.lat) : undefined,
                lng: address.lng ? parseFloat(address.lng) : undefined,
                precinct: address.precinct,
                splitDistrict: address.splitDistrict,
                parcelId: address.parcelId
            })
            
            if (result.data?.id) {
                addressIdMap.set(address.id, result.data.id)
                addressCount++
                if (addressCount % 100 === 0) {
                    console.log(`  Imported ${addressCount} addresses...`)
                }
            }
        } catch (error) {
            console.error(`Failed to import address ${address.street}:`, error.message)
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
            const newAddressId = addressIdMap.get(resident.addressId)
            if (!newAddressId) {
                console.warn(`Skipping resident ${resident.firstName} ${resident.lastName} - address not found`)
                residentErrors++
                continue
            }

            const result = await client.models.Resident.create({
                addressId: newAddressId,
                firstName: resident.firstName,
                lastName: resident.lastName,
                email: resident.email || undefined,
                phone: resident.phone || undefined,
                party: resident.party || undefined,
                role: resident.role || resident.occupantType || 'OTHER',
                isAbsentee: resident.isAbsentee === 'true' || resident.isAbsentee === true,
                registeredVoter: resident.registeredVoter === 'true' || resident.registeredVoter === true,
                voteByMail: resident.voteByMail === 'true' || resident.voteByMail === true
            })
            
            if (result.data?.id) {
                residentCount++
                if (residentCount % 100 === 0) {
                    console.log(`  Imported ${residentCount} residents...`)
                }
            }
        } catch (error) {
            console.error(`Failed to import resident ${resident.firstName} ${resident.lastName}:`, error.message)
            residentErrors++
        }
    }
    
    console.log(`✅ Imported ${residentCount} residents (${residentErrors} errors)`)
    
    // Summary
    console.log('\n📊 Import Summary:')
    console.log(`  Addresses: ${addressCount} imported, ${addressErrors} errors`)
    console.log(`  Residents: ${residentCount} imported, ${residentErrors} errors`)
    console.log('\n✨ Production data import complete!')
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})