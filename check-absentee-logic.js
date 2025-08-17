import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function checkAbsenteeLogic() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== CHECKING ABSENTEE OWNER LOGIC ===')
        
        // Check how many homes are marked as absentee
        const absenteeResult = await client.models.Home.list({
            filter: { absenteeOwner: { eq: true } },
            limit: 10
        })
        
        console.log(`Homes marked as absentee: ${absenteeResult.data.length}`)
        
        if (absenteeResult.data.length > 0) {
            console.log('\nFirst few absentee homes:')
            absenteeResult.data.slice(0, 3).forEach(home => {
                console.log(`- ${home.street}, ${home.city}`)
                console.log(`  Property: ${home.street}, ${home.city}, ${home.state}`)
                console.log(`  Mailing: ${home.mailingStreet || 'N/A'}, ${home.mailingCity || 'N/A'}, ${home.mailingState || 'N/A'}`)
                console.log(`  Different addresses: ${home.mailingStreet !== home.street}`)
                console.log('')
            })
        }
        
        // Check homes with different mailing addresses
        console.log('\n=== CHECKING HOMES WITH DIFFERENT MAILING ADDRESSES ===')
        
        let allHomes = []
        let nextToken = null
        let checkedCount = 0
        
        do {
            const result = await client.models.Home.list({
                limit: 100,
                nextToken
            })
            
            for (const home of result.data) {
                checkedCount++
                
                // Check if mailing address is different from property address
                const hasMailingAddress = home.mailingStreet && home.mailingStreet.trim()
                const isDifferentAddress = hasMailingAddress && home.mailingStreet !== home.street
                
                if (isDifferentAddress) {
                    allHomes.push(home)
                }
                
                // Stop after checking first 1000 to avoid timeout
                if (checkedCount >= 1000) break
            }
            
            nextToken = result.nextToken
        } while (nextToken && checkedCount < 1000)
        
        console.log(`Checked ${checkedCount} homes`)
        console.log(`Found ${allHomes.length} homes with different mailing addresses`)
        
        if (allHomes.length > 0) {
            console.log('\nFirst few homes with different mailing addresses:')
            allHomes.slice(0, 5).forEach(home => {
                console.log(`- ${home.street}, ${home.city}`)
                console.log(`  Property: ${home.street}, ${home.city}`)
                console.log(`  Mailing: ${home.mailingStreet}, ${home.mailingCity || home.city}`)
                console.log(`  AbsenteeOwner flag: ${home.absenteeOwner}`)
                console.log('')
            })
        }
        
        // Check the logic from import script
        console.log('\n=== TESTING IMPORT LOGIC ===')
        const testCases = [
            { street: '123 Main St', mailingStreet: '456 Oak Ave' },
            { street: '123 Main St', mailingStreet: '123 Main St' },
            { street: '123 Main St', mailingStreet: '' },
            { street: '123 Main St', mailingStreet: null }
        ]
        
        testCases.forEach(testCase => {
            const absenteeOwner = Boolean(testCase.mailingStreet && testCase.mailingStreet.trim() && (testCase.mailingStreet !== testCase.street))
            console.log(`Property: ${testCase.street}, Mailing: ${testCase.mailingStreet || 'N/A'} -> Absentee: ${absenteeOwner}`)
        })
        
    } catch (error) {
        console.error('Error:', error)
    }
}

checkAbsenteeLogic()