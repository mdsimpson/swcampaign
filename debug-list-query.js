import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugListQuery() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Debug List Query Issues ===')
        
        // Try to get ALL records with pagination
        let allFromList = []
        let nextToken = null
        let pageCount = 0
        
        do {
            const result = await client.models.Home.list({
                nextToken: nextToken,
                limit: 1000  // Max limit
            })
            
            allFromList = allFromList.concat(result.data)
            nextToken = result.nextToken
            pageCount++
            
            console.log(`Page ${pageCount}: ${result.data.length} homes, nextToken: ${nextToken ? 'yes' : 'no'}`)
            
        } while (nextToken && pageCount < 10) // Safety limit
        
        console.log(`\nTotal homes from paginated list(): ${allFromList.length}`)
        
        // Compare with individual fetch
        const peopleResult = await client.models.Person.list()
        const homeIdsWithResidents = [...new Set(peopleResult.data.map(p => p.homeId))]
        
        console.log(`Home IDs with residents: ${homeIdsWithResidents.length}`)
        
        // Check if any homes with residents appear in the paginated results
        const paginatedIds = new Set(allFromList.map(h => h.id))
        const overlap = homeIdsWithResidents.filter(id => paginatedIds.has(id))
        console.log(`Overlap with paginated results: ${overlap.length}`)
        
        if (overlap.length === 0) {
            console.log('\n🔍 Testing if this is an authorization mode issue...')
            
            // Try default auth mode
            try {
                const defaultClient = generateClient() // No explicit auth mode
                const defaultResult = await defaultClient.models.Home.list({ limit: 5 })
                console.log(`Default auth mode returned: ${defaultResult.data.length} homes`)
                
                const defaultIds = new Set(defaultResult.data.map(h => h.id))
                const defaultOverlap = homeIdsWithResidents.filter(id => defaultIds.has(id))
                console.log(`Default auth overlap with residents: ${defaultOverlap.length}`)
                
                if (defaultOverlap.length > 0) {
                    console.log('✅ FOUND THE ISSUE: Homes with residents require default auth mode!')
                    
                    // Show sample
                    console.log('\nSample homes with residents (default auth):')
                    for (const homeId of homeIdsWithResidents.slice(0, 3)) {
                        const homeResult = await defaultClient.models.Home.get({ id: homeId })
                        if (homeResult.data) {
                            const residents = await defaultClient.models.Person.list({
                                filter: { homeId: { eq: homeId } }
                            })
                            console.log(`  ${homeResult.data.street}: ${residents.data.length} residents`)
                        }
                    }
                }
                
            } catch (error) {
                console.log(`Default auth failed: ${error.message}`)
            }
            
            // Try userPool auth mode explicitly
            try {
                const userPoolClient = generateClient({ authMode: 'userPool' })
                const userPoolResult = await userPoolClient.models.Home.list({ limit: 5 })
                console.log(`UserPool auth mode returned: ${userPoolResult.data.length} homes`)
            } catch (error) {
                console.log(`UserPool auth failed: ${error.message}`)
            }
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

debugListQuery()