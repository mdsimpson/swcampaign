import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))

Amplify.configure(outputs)

async function testAuth() {
    try {
        console.log('=== Testing API Key Auth ===')
        const apiKeyClient = generateClient({
            authMode: 'apiKey'
        })
        
        console.log('\n--- Homes ---')
        const homesResult = await apiKeyClient.models.Home.list({ limit: 5 })
        console.log(`API Key - Homes found: ${homesResult.data.length}`)
        
        homesResult.data.forEach((home, i) => {
            console.log(`${i+1}. ${home.id}: ${home.unitNumber ? `${home.unitNumber} ` : ''}${home.street}, ${home.city}, ${home.state}`)
            console.log(`   Absentee: ${home.absenteeOwner}`)
        })
        
        console.log('\n--- People ---')
        const peopleResult = await apiKeyClient.models.Person.list({ limit: 10 })
        console.log(`API Key - People found: ${peopleResult.data.length}`)
        
        peopleResult.data.forEach((person, i) => {
            console.log(`${i+1}. ${person.firstName} ${person.lastName} (${person.role}) - Home: ${person.homeId}`)
        })
        
        if (homesResult.data.length > 0 && peopleResult.data.length > 0) {
            console.log('\n--- Testing Home-Person Relationships ---')
            const firstHome = homesResult.data[0]
            const residentsResult = await apiKeyClient.models.Person.list({
                filter: { homeId: { eq: firstHome.id } }
            })
            console.log(`Residents for home ${firstHome.street}: ${residentsResult.data.length}`)
            residentsResult.data.forEach(r => {
                console.log(`  - ${r.firstName} ${r.lastName} (${r.role})`)
            })
        }
        
        console.log('\n--- Summary ---')
        console.log(`Total homes: ${homesResult.data.length}`)
        console.log(`Total people: ${peopleResult.data.length}`)
        console.log(`Homes with absentee owners: ${homesResult.data.filter(h => h.absenteeOwner).length}`)
        
    } catch (error) {
        console.error('Error with API key auth:', error.message)
        console.error('Full error:', error)
    }
    
    process.exit(0)
}

testAuth()