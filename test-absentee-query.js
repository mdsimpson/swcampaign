import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testAbsenteeQuery() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING EXACT ABSENTEE PAGE QUERY ===')
        
        // Test the exact query from AbsenteeInteractions page
        const homeFilter = { absenteeOwner: { eq: true } }
        
        console.log('Filter:', JSON.stringify(homeFilter, null, 2))
        
        const result = await client.models.Home.list({
            filter: homeFilter,
            limit: 20
        })
        
        console.log(`Query returned: ${result.data.length} homes`)
        
        if (result.data.length > 0) {
            console.log('\nFirst few results:')
            result.data.slice(0, 3).forEach(home => {
                console.log(`- ${home.street}, ${home.city}`)
                console.log(`  AbsenteeOwner: ${home.absenteeOwner}`)
                console.log(`  Mailing: ${home.mailingStreet || 'N/A'}`)
            })
        } else {
            console.log('No results found!')
            
            // Try alternative queries
            console.log('\n=== TRYING ALTERNATIVE QUERIES ===')
            
            // Try without the filter
            const allResult = await client.models.Home.list({ limit: 5 })
            console.log(`All homes query: ${allResult.data.length} results`)
            
            if (allResult.data.length > 0) {
                console.log('Sample home:')
                const home = allResult.data[0]
                console.log(`- ${home.street}, ${home.city}`)
                console.log(`  AbsenteeOwner: ${home.absenteeOwner} (type: ${typeof home.absenteeOwner})`)
                console.log(`  Mailing: ${home.mailingStreet || 'N/A'}`)
            }
            
            // Try different filter syntax
            console.log('\nTrying { absenteeOwner: true }...')
            const altResult = await client.models.Home.list({
                filter: { absenteeOwner: true },
                limit: 5
            })
            console.log(`Alternative filter: ${altResult.data.length} results`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testAbsenteeQuery()