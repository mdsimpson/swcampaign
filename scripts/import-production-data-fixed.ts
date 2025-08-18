import fs from 'node:fs'
import { parse } from 'csv-parse/sync'

// Production configuration
const GRAPHQL_ENDPOINT = process.env.PROD_GRAPHQL_ENDPOINT!
const API_KEY = process.env.PROD_API_KEY!

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
    // Check for required environment variables
    if (!GRAPHQL_ENDPOINT || !API_KEY) {
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
npm run import:production:fixed

`)
        process.exit(1)
    }

    console.log('🚀 Starting production data import...')
    console.log('GraphQL Endpoint:', GRAPHQL_ENDPOINT)
    
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

    const createAddressMutation = `
        mutation CreateAddress($input: CreateAddressInput!) {
            createAddress(input: $input) {
                id
                street
                city
                state
                zip
            }
        }
    `

    for (const address of addresses) {
        try {
            // Handle case-sensitive CSV headers
            const input = {
                street: address.Street || address.street,
                city: address.City || address.city || 'Broadlands',
                state: address.State || address.state || 'VA',
                zip: address.Zip || address.zip || '20148',
                lat: address.lat ? parseFloat(address.lat) : null,
                lng: address.lng ? parseFloat(address.lng) : null
            }
            
            const result = await graphqlRequest(createAddressMutation, { input })
            
            if (result?.createAddress?.id) {
                addressIdMap.set(address.id, result.createAddress.id)
                addressCount++
                if (addressCount % 100 === 0) {
                    console.log(`  Imported ${addressCount} addresses...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed to import address ${address.street}:`, error.message?.substring(0, 100))
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
            }
        }
    `

    for (const resident of residents) {
        try {
            // Handle the actual CSV column names
            const addressId = resident.address_id || resident.addressId
            const firstName = resident['Occupant First Name'] || resident.firstName
            const lastName = resident['Occupant Last Name'] || resident.lastName
            
            // Get the new address ID from our mapping
            const newAddressId = addressIdMap.get(addressId)
            if (!newAddressId) {
                console.warn(`Skipping resident ${firstName} ${lastName} - address not found`)
                residentErrors++
                continue
            }

            const input = {
                addressId: newAddressId,
                firstName: firstName,
                lastName: lastName,
                email: resident['Contact Email'] || resident.email || null,
                phone: resident['Cell Phone'] || resident.phone || null,
                party: resident.party || null,
                role: resident['Occupant Type'] || resident.role || resident.occupantType || 'OTHER',
                isAbsentee: resident['Is Absentee'] === 'true' || resident['Is Absentee'] === true,
                registeredVoter: resident.registeredVoter === 'true' || resident.registeredVoter === true,
                voteByMail: resident.voteByMail === 'true' || resident.voteByMail === true
            }
            
            const result = await graphqlRequest(createResidentMutation, { input })
            
            if (result?.createResident?.id) {
                residentCount++
                if (residentCount % 100 === 0) {
                    console.log(`  Imported ${residentCount} residents...`)
                }
            }
        } catch (error: any) {
            console.error(`Failed to import resident ${resident.firstName} ${resident.lastName}:`, error.message?.substring(0, 100))
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