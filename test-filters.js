import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testFilters() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Testing Different Filter Approaches ===')
        
        // Test 1: No filter
        console.log('\n1. No filter (get all homes):')
        const allResult = await client.models.Home.list({ limit: 5 })
        console.log(`Count: ${allResult.data.length}`)
        allResult.data.forEach(home => {
            console.log(`  - ${home.street}: absenteeOwner = ${home.absenteeOwner} (type: ${typeof home.absenteeOwner})`)
        })
        
        // Test 2: Filter absenteeOwner equals false
        console.log('\n2. Filter: { absenteeOwner: { eq: false } }')
        try {
            const eqFalseResult = await client.models.Home.list({ 
                filter: { absenteeOwner: { eq: false } },
                limit: 5
            })
            console.log(`Count: ${eqFalseResult.data.length}`)
            eqFalseResult.data.forEach(home => {
                console.log(`  - ${home.street}: absenteeOwner = ${home.absenteeOwner}`)
            })
        } catch (error) {
            console.log(`Error: ${error.message}`)
        }
        
        // Test 3: Filter absenteeOwner not equal to true
        console.log('\n3. Filter: { absenteeOwner: { ne: true } }')
        try {
            const neResult = await client.models.Home.list({ 
                filter: { absenteeOwner: { ne: true } },
                limit: 5
            })
            console.log(`Count: ${neResult.data.length}`)
            neResult.data.forEach(home => {
                console.log(`  - ${home.street}: absenteeOwner = ${home.absenteeOwner}`)
            })
        } catch (error) {
            console.log(`Error: ${error.message}`)
        }
        
        // Test 4: Filter absenteeOwner equals true (absentee homes)
        console.log('\n4. Filter: { absenteeOwner: { eq: true } }')
        try {
            const eqTrueResult = await client.models.Home.list({ 
                filter: { absenteeOwner: { eq: true } },
                limit: 5
            })
            console.log(`Count: ${eqTrueResult.data.length}`)
            eqTrueResult.data.forEach(home => {
                console.log(`  - ${home.street}: absenteeOwner = ${home.absenteeOwner}`)
            })
        } catch (error) {
            console.log(`Error: ${error.message}`)
        }
        
        // Test 5: Check if null/undefined values are causing issues
        console.log('\n5. Check for null/undefined absenteeOwner values:')
        const allHomesResult = await client.models.Home.list()
        const nullValues = allHomesResult.data.filter(home => home.absenteeOwner === null || home.absenteeOwner === undefined)
        const trueValues = allHomesResult.data.filter(home => home.absenteeOwner === true)
        const falseValues = allHomesResult.data.filter(home => home.absenteeOwner === false)
        
        console.log(`Total homes: ${allHomesResult.data.length}`)
        console.log(`absenteeOwner === true: ${trueValues.length}`)
        console.log(`absenteeOwner === false: ${falseValues.length}`)
        console.log(`absenteeOwner === null/undefined: ${nullValues.length}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

testFilters()