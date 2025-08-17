import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function simpleTest() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('Testing basic table operations...')
        
        // Try to list homes (should work even if empty)
        console.log('1. Listing homes...')
        const homesList = await client.models.Home.list({ limit: 5 })
        console.log(`✓ Home.list() worked. Found ${homesList.data.length} homes`)
        
        // Try to create a simple home
        console.log('2. Creating a test home...')
        const createResult = await client.models.Home.create({
            street: 'Test Street',
            city: 'Test City'
        })
        
        console.log('Create result:', createResult)
        
        if (createResult.data) {
            console.log(`✓ Successfully created home with ID: ${createResult.data.id}`)
            
            // List again to verify
            const homesList2 = await client.models.Home.list({ limit: 5 })
            console.log(`✓ Now have ${homesList2.data.length} homes`)
            
            // Delete the test home
            const deleteResult = await client.models.Home.delete({ id: createResult.data.id })
            console.log('Delete result:', deleteResult)
            
        } else {
            console.log('❌ Create returned null data')
            console.log('Full create result:', JSON.stringify(createResult, null, 2))
        }
        
    } catch (error) {
        console.error('Error in simple test:', error)
        console.error('Error details:', error.message)
    }
}

simpleTest()