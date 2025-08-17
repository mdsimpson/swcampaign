import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function checkTotalCounts() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        // Count homes
        let totalHomes = 0
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 1000,
                nextToken
            })
            totalHomes += result.data.length
            nextToken = result.nextToken
        } while (nextToken)
        
        // Count people
        let totalPeople = 0
        nextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken
            })
            totalPeople += result.data.length
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`=== FINAL IMPORT RESULTS ===`)
        console.log(`Total Homes: ${totalHomes}`)
        console.log(`Total People: ${totalPeople}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

checkTotalCounts()