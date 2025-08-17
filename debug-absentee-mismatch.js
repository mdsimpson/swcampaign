import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugMismatch() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== DEBUGGING ABSENTEE MISMATCH ===')
        
        // Get first 100 homes and check each one manually
        const result = await client.models.Home.list({ limit: 100 })
        console.log(`Fetched ${result.data.length} homes`)
        
        let manualAbsenteeCount = 0
        let trueAbsenteeCount = 0
        
        result.data.forEach((home, i) => {
            // Manual check like the previous script
            const hasMailingAddress = home.mailingStreet && home.mailingStreet.trim()
            const isDifferentAddress = hasMailingAddress && home.mailingStreet !== home.street
            
            if (isDifferentAddress) {
                manualAbsenteeCount++
                if (i < 5) {
                    console.log(`Manual absentee ${manualAbsenteeCount}: ${home.street}`)
                    console.log(`  Property: ${home.street}`)
                    console.log(`  Mailing: ${home.mailingStreet}`)
                    console.log(`  absenteeOwner field: ${home.absenteeOwner}`)
                    console.log('')
                }
            }
            
            // Check the actual field value
            if (home.absenteeOwner === true) {
                trueAbsenteeCount++
            }
        })
        
        console.log(`Manual logic found: ${manualAbsenteeCount} absentee homes`)
        console.log(`absenteeOwner=true found: ${trueAbsenteeCount} homes`)
        
        // Now test GraphQL filter on this same subset
        console.log('\n=== TESTING GRAPHQL FILTER ON SAME DATA ===')
        
        // Get homes where absenteeOwner is true using GraphQL filter
        const filteredResult = await client.models.Home.list({
            filter: { absenteeOwner: { eq: true } },
            limit: 100
        })
        
        console.log(`GraphQL filter found: ${filteredResult.data.length} homes`)
        
        // Also try other boolean filter formats
        console.log('\n=== TRYING OTHER FILTER FORMATS ===')
        
        try {
            const filter2 = await client.models.Home.list({
                filter: { absenteeOwner: true },
                limit: 10
            })
            console.log(`Direct boolean filter: ${filter2.data.length} results`)
        } catch (e) {
            console.log(`Direct boolean filter failed: ${e.message}`)
        }
        
        try {
            const filter3 = await client.models.Home.list({
                filter: { absenteeOwner: { ne: false } },
                limit: 10
            })
            console.log(`ne: false filter: ${filter3.data.length} results`)
        } catch (e) {
            console.log(`ne: false filter failed: ${e.message}`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugMismatch()