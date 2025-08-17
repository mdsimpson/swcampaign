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
        
        const homesResult = await apiKeyClient.models.Home.list({ limit: 3 })
        console.log(`API Key - Homes found: ${homesResult.data.length}`)
        
        if (homesResult.data.length > 0) {
            const firstHome = homesResult.data[0]
            console.log(`First home: ${firstHome.street}`)
            
            const residentsResult = await apiKeyClient.models.Person.list({
                filter: { homeId: { eq: firstHome.id } }
            })
            console.log(`Residents: ${residentsResult.data.length}`)
            residentsResult.data.forEach(r => {
                console.log(`  - ${r.firstName} ${r.lastName}`)
            })
        }
        
    } catch (error) {
        console.error('Error with API key auth:', error.message)
    }
    
    process.exit(0)
}

testAuth()