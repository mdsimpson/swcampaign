import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'
import outputs from '../amplify_outputs.json'
import * as fs from 'fs'
import * as path from 'path'

interface FixData {
    residentId: string
    firstName: string
    lastName: string
    shouldBeAbsentee: boolean
    currentIsAbsentee: boolean
}

// Configure Amplify
Amplify.configure(outputs)

const client = generateClient<Schema>({
    authMode: 'apiKey'
})

async function main() {
    const fixDataPath = path.join(process.cwd(), 'scripts/absentee-fixes.json')
    
    // Load fix data
    const fixData: FixData[] = JSON.parse(fs.readFileSync(fixDataPath, 'utf8'))
    
    // Get records to update (set isAbsentee to false)
    const recordsToFix = fixData.filter(f => !f.shouldBeAbsentee)
    
    console.log(`Updating ${recordsToFix.length} resident records in production database...`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const record of recordsToFix) {
        try {
            console.log(`Updating ${record.firstName} ${record.lastName} (ID: ${record.residentId})...`)
            
            const result = await client.models.Resident.update({
                id: record.residentId,
                isAbsentee: false
            })
            
            if (result.data) {
                successCount++
                console.log(`✓ Updated ${record.firstName} ${record.lastName}`)
            } else {
                errorCount++
                console.error(`✗ Failed to update ${record.firstName} ${record.lastName}: No data returned`)
                if (result.errors) {
                    console.error('Errors:', result.errors)
                }
            }
        } catch (error) {
            errorCount++
            console.error(`✗ Error updating ${record.firstName} ${record.lastName}:`, error)
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log(`\nUpdate complete!`)
    console.log(`✓ Successfully updated: ${successCount} records`)
    console.log(`✗ Errors: ${errorCount} records`)
    
    if (errorCount > 0) {
        console.log('\nSome records failed to update. Please check the errors above.')
    }
}

main().catch(console.error)