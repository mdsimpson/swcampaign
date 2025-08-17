import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testOrganizeLogic() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('Testing Organize page logic...')
        
        // Use the same filter as Organize page
        const homeFilter = { absenteeOwner: { ne: true } }
        
        const homesResult = await client.models.Home.list({
            filter: homeFilter,
            limit: 5
        })
        
        console.log(`Found ${homesResult.data.length} homes with filter`)
        
        for (const home of homesResult.data) {
            console.log(`\n=== ${home.street}, ${home.city} ===`)
            console.log(`ID: ${home.id}`)
            console.log(`Absentee: ${home.absenteeOwner}`)
            
            // Try the same resident lookup as Organize page
            const residentsResult = await client.models.Person.list({ 
                filter: { homeId: { eq: home.id } } 
            })
            
            console.log(`Residents found: ${residentsResult.data.length}`)
            residentsResult.data.forEach(resident => {
                console.log(`  - ${resident.firstName} ${resident.lastName} (${resident.role})`)
            })
        }
        
        // Also test without the filter
        console.log('\n=== TESTING WITHOUT ABSENTEE FILTER ===')
        const allHomesResult = await client.models.Home.list({ limit: 3 })
        
        for (const home of allHomesResult.data) {
            console.log(`\n${home.street} - Absentee: ${home.absenteeOwner}`)
            const residentsResult = await client.models.Person.list({ 
                filter: { homeId: { eq: home.id } } 
            })
            console.log(`  Residents: ${residentsResult.data.length}`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

testOrganizeLogic()