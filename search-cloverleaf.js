import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function searchCloverleaf() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== SEARCHING FOR CLOVERLEAF ADDRESSES ===')
        
        // Search through all homes for Cloverleaf
        let foundCloverleaf = []
        let nextToken = null
        let checkedCount = 0
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                checkedCount++
                
                if (home.street && home.street.toLowerCase().includes('cloverleaf')) {
                    foundCloverleaf.push(home)
                    console.log(`Found: ${home.street}, ${home.city}`)
                    console.log(`  ID: ${home.id}`)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken && foundCloverleaf.length < 10 && checkedCount < 2000)
        
        console.log(`\nChecked ${checkedCount} homes`)
        console.log(`Found ${foundCloverleaf.length} homes with "Cloverleaf"`)
        
        if (foundCloverleaf.length > 0) {
            console.log('\nFirst few Cloverleaf addresses:')
            foundCloverleaf.slice(0, 5).forEach(home => {
                console.log(`- ${home.street}, ${home.city}`)
            })
            
            // Now check if any of these have residents
            console.log('\n=== CHECKING RESIDENTS FOR CLOVERLEAF HOMES ===')
            
            for (const home of foundCloverleaf.slice(0, 3)) {
                const residentsResult = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                })
                
                console.log(`${home.street}: ${residentsResult.data.length} residents`)
                if (residentsResult.data.length > 0) {
                    residentsResult.data.forEach(person => {
                        console.log(`  - ${person.firstName} ${person.lastName}`)
                    })
                }
            }
        } else {
            console.log('No homes with "Cloverleaf" found!')
        }
        
        // Also search with different variations
        console.log('\n=== SEARCHING VARIATIONS ===')
        const variations = ['clover', 'leaf', 'Clover']
        
        for (const variation of variations) {
            let count = 0
            let nextToken = null
            
            do {
                const result = await client.models.Home.list({
                    limit: 100,
                    nextToken
                })
                
                for (const home of result.data) {
                    if (home.street && home.street.toLowerCase().includes(variation.toLowerCase())) {
                        count++
                        if (count <= 3) {
                            console.log(`"${variation}" match: ${home.street}`)
                        }
                    }
                }
                
                nextToken = result.nextToken
            } while (nextToken && count < 10)
            
            console.log(`Found ${count} homes with "${variation}"`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

searchCloverleaf()