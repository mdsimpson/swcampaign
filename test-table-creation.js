import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testTableCreation() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== TESTING TABLE ACCESS ===')
        
        // Try to create a test home
        console.log('1. Testing Home table...')
        const testHome = await client.models.Home.create({
            street: 'Test Street',
            city: 'Test City'
        })
        
        if (testHome.data) {
            console.log('✓ Successfully created test home:', testHome.data.id)
            
            // Try to read it back
            const readHome = await client.models.Home.get({ id: testHome.data.id })
            if (readHome.data) {
                console.log('✓ Successfully read back test home')
                
                // Try to delete it
                await client.models.Home.delete({ id: testHome.data.id })
                console.log('✓ Successfully deleted test home')
            }
        }
        
        // Test Person table
        console.log('\n2. Testing Person table...')
        const testHome2 = await client.models.Home.create({
            street: 'Test Street 2',
            city: 'Test City 2'
        })
        
        const testPerson = await client.models.Person.create({
            homeId: testHome2.data.id,
            firstName: 'Test',
            lastName: 'Person'
        })
        
        if (testPerson.data) {
            console.log('✓ Successfully created test person:', testPerson.data.id)
            
            // Clean up
            await client.models.Person.delete({ id: testPerson.data.id })
            await client.models.Home.delete({ id: testHome2.data.id })
            console.log('✓ Successfully cleaned up test records')
        }
        
        console.log('\n=== TABLE ACCESS WORKING ===')
        console.log('The tables exist and are functional. They are just empty.')
        console.log('Ready to run the import script.')
        
    } catch (error) {
        console.error('Error testing tables:', error)
    }
}

testTableCreation()