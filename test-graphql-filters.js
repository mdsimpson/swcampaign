import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testGraphQLFilters() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING DIFFERENT GRAPHQL FILTER APPROACHES ===')
        
        // Test 1: No filter at all
        console.log('\n1. Testing no filter...')
        const noFilterResult = await client.models.Home.list({ limit: 5 })
        console.log(`No filter: ${noFilterResult.data.length} homes`)
        if (noFilterResult.data.length > 0) {
            console.log(`Sample: ${noFilterResult.data[0].street}`)
        }
        
        // Test 2: Simple exact match
        console.log('\n2. Testing exact match...')
        const exactResult = await client.models.Home.list({
            filter: { street: { eq: '42927 Cloverleaf Ct' } },
            limit: 5
        })
        console.log(`Exact match: ${exactResult.data.length} homes`)
        
        // Test 3: Try beginsWith
        console.log('\n3. Testing beginsWith...')
        const beginsResult = await client.models.Home.list({
            filter: { street: { beginsWith: '42927' } },
            limit: 5
        })
        console.log(`Begins with "42927": ${beginsResult.data.length} homes`)
        
        // Test 4: Try contains with exact case
        console.log('\n4. Testing contains with exact case...')
        const containsResult = await client.models.Home.list({
            filter: { street: { contains: 'Cloverleaf' } },
            limit: 5
        })
        console.log(`Contains "Cloverleaf": ${containsResult.data.length} homes`)
        
        // Test 5: Try contains with different case
        console.log('\n5. Testing contains with lowercase...')
        const containsLowerResult = await client.models.Home.list({
            filter: { street: { contains: 'cloverleaf' } },
            limit: 5
        })
        console.log(`Contains "cloverleaf": ${containsLowerResult.data.length} homes`)
        
        // Test 6: Get a known Cloverleaf home and check its exact street value
        console.log('\n6. Finding Cloverleaf homes manually and checking case...')
        let foundCloverleaf = []
        let nextToken = null
        let checked = 0
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                checked++
                if (home.street && home.street.toLowerCase().includes('cloverleaf')) {
                    foundCloverleaf.push(home)
                    if (foundCloverleaf.length <= 3) {
                        console.log(`Found: "${home.street}" (exact case)`)
                    }
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken && foundCloverleaf.length < 5 && checked < 1000)
        
        console.log(`Manual search found ${foundCloverleaf.length} homes in ${checked} checked`)
        
        if (foundCloverleaf.length > 0) {
            const exactStreet = foundCloverleaf[0].street
            console.log(`\n7. Testing exact case "${exactStreet}"...`)
            const exactCaseResult = await client.models.Home.list({
                filter: { street: { contains: exactStreet.split(' ')[1] } }, // "Cloverleaf"
                limit: 5
            })
            console.log(`Exact case contains: ${exactCaseResult.data.length} homes`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testGraphQLFilters()