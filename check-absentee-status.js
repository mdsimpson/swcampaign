import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function checkAbsenteeStatus() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== Checking Absentee Status of All Homes ===')
        
        // Get all homes
        const allHomesResult = await client.models.Home.list()
        const allHomes = allHomesResult.data
        
        console.log(`Total homes in database: ${allHomes.length}`)
        
        const absenteeHomes = allHomes.filter(h => h.absenteeOwner === true)
        const nonAbsenteeHomes = allHomes.filter(h => h.absenteeOwner !== true)
        
        console.log(`Absentee homes: ${absenteeHomes.length}`)
        console.log(`Non-absentee homes: ${nonAbsenteeHomes.length}`)
        
        console.log('\n--- Sample of all homes with absentee status ---')
        allHomes.slice(0, 10).forEach((home, i) => {
            const address = home.unitNumber && home.street && home.unitNumber !== home.street 
                ? `${home.unitNumber} ${home.street}` 
                : (home.street || home.unitNumber)
            
            console.log(`${i+1}. ${address} - Absentee: ${home.absenteeOwner}`)
            if (home.mailingStreet) {
                console.log(`   Property: ${address}`)
                console.log(`   Mailing:  ${home.mailingStreet}`)
                console.log(`   Same address? ${home.street === home.mailingStreet}`)
            }
            console.log()
        })
        
        if (absenteeHomes.length > 0) {
            console.log('\n--- All absentee homes ---')
            absenteeHomes.forEach((home, i) => {
                const address = home.unitNumber && home.street && home.unitNumber !== home.street 
                    ? `${home.unitNumber} ${home.street}` 
                    : (home.street || home.unitNumber)
                
                console.log(`${i+1}. ${address}`)
                console.log(`   Property: ${address}, ${home.city}, ${home.state}`)
                console.log(`   Mailing:  ${home.mailingStreet || 'N/A'}, ${home.mailingCity || 'N/A'}, ${home.mailingState || 'N/A'}`)
                console.log()
            })
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
    
    process.exit(0)
}

checkAbsenteeStatus()