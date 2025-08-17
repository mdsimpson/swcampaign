import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugAbsenteeOwners() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== DEBUGGING ABSENTEE OWNERS ISSUE ===')
        
        // First, let's manually find some homes that should be absentee
        console.log('1. Finding homes with different mailing addresses...')
        
        let foundAbsenteeHome = null
        let checkedCount = 0
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 100,
                nextToken
            })
            
            for (const home of result.data) {
                checkedCount++
                
                const hasMailingAddress = home.mailingStreet && home.mailingStreet.trim()
                const isDifferentAddress = hasMailingAddress && home.mailingStreet !== home.street
                
                if (isDifferentAddress && home.absenteeOwner === true) {
                    foundAbsenteeHome = home
                    console.log(`Found absentee home: ${home.street}, ${home.city}`)
                    console.log(`  Property: ${home.street}`)
                    console.log(`  Mailing: ${home.mailingStreet}`)
                    console.log(`  Home ID: ${home.id}`)
                    console.log(`  AbsenteeOwner flag: ${home.absenteeOwner}`)
                    break
                }
            }
            
            if (foundAbsenteeHome) break
            nextToken = result.nextToken
        } while (nextToken && checkedCount < 1000)
        
        if (!foundAbsenteeHome) {
            console.log('No absentee homes found in first 1000 homes!')
            return
        }
        
        console.log('\n2. Looking for residents of this absentee home...')
        
        // Try to find residents for this specific absentee home
        const residentsResult = await client.models.Person.list({
            filter: { homeId: { eq: foundAbsenteeHome.id } }
        })
        
        console.log(`Direct resident query found: ${residentsResult.data.length} residents`)
        
        if (residentsResult.data.length > 0) {
            residentsResult.data.forEach(person => {
                console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
                console.log(`    Person ID: ${person.id}`)
                console.log(`    Home ID: ${person.homeId}`)
            })
        } else {
            console.log('No residents found for this absentee home!')
            
            // Let's check if there are ANY residents with this homeId
            console.log('\n3. Checking if anyone has this homeId...')
            
            const allPeople = await client.models.Person.list({ limit: 1000 })
            let foundMatch = false
            
            allPeople.data.forEach(person => {
                if (person.homeId === foundAbsenteeHome.id) {
                    foundMatch = true
                    console.log(`Found person: ${person.firstName} ${person.lastName} with matching homeId`)
                }
            })
            
            if (!foundMatch) {
                console.log('No people found with this homeId in first 1000 people')
            }
        }
        
        console.log('\n4. Testing the AbsenteeInteractions page logic...')
        
        // Simulate what the AbsenteeInteractions page does
        const absenteeFilter = { absenteeOwner: { eq: true } }
        const absenteeHomesResult = await client.models.Home.list({
            filter: absenteeFilter,
            limit: 10
        })
        
        console.log(`AbsenteeInteractions filter found: ${absenteeHomesResult.data.length} homes`)
        
        if (absenteeHomesResult.data.length > 0) {
            const firstAbsenteeHome = absenteeHomesResult.data[0]
            console.log(`First absentee home: ${firstAbsenteeHome.street}`)
            
            const residentsForFirst = await client.models.Person.list({
                filter: { homeId: { eq: firstAbsenteeHome.id } }
            })
            
            console.log(`Residents for first absentee home: ${residentsForFirst.data.length}`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugAbsenteeOwners()