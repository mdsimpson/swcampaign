import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function checkAbsenteeStats() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('Checking absentee owner statistics...')
        
        // Count absentee vs non-absentee homes
        const absenteeResult = await client.models.Home.list({
            filter: { absenteeOwner: { eq: true } }
        })
        
        const nonAbsenteeResult = await client.models.Home.list({
            filter: { absenteeOwner: { ne: true } }
        })
        
        console.log(`Absentee homes: ${absenteeResult.data.length}`)
        console.log(`Non-absentee homes: ${nonAbsenteeResult.data.length}`)
        console.log(`Total expected: 29558`)
        
        // Check a few non-absentee homes to see if they have residents
        console.log('\n=== Checking non-absentee homes for residents ===')
        
        for (const home of nonAbsenteeResult.data.slice(0, 5)) {
            const residentsResult = await client.models.Person.list({ 
                filter: { homeId: { eq: home.id } } 
            })
            console.log(`${home.street}: ${residentsResult.data.length} residents`)
        }
        
        // Also check some absentee homes
        console.log('\n=== Checking absentee homes for residents ===')
        
        for (const home of absenteeResult.data.slice(0, 5)) {
            const residentsResult = await client.models.Person.list({ 
                filter: { homeId: { eq: home.id } } 
            })
            console.log(`${home.street}: ${residentsResult.data.length} residents`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

checkAbsenteeStats()