import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'
import config from '../amplify_outputs.json'

Amplify.configure(config)

const client = generateClient<Schema>({
    authMode: 'apiKey'
})

async function syncPersonIds() {
    console.log('Fetching all residents...')

    // Fetch all residents with pagination
    const allResidents: any[] = []
    let nextToken: string | null | undefined = null

    do {
        const result = await client.models.Resident.list({
            limit: 1000,
            nextToken: nextToken as string | undefined
        })

        console.log('Result:', {
            dataLength: result.data?.length || 0,
            hasNextToken: !!result.nextToken,
            errors: result.errors
        })

        if (result.errors) {
            console.error('Errors fetching residents:', result.errors)
        }

        if (result.data) {
            allResidents.push(...result.data)
        }

        nextToken = result.nextToken
    } while (nextToken)

    console.log(`Found ${allResidents.length} residents`)

    // Find residents that need updating
    const needsUpdate = allResidents.filter(r => {
        const hasPersonId = r.personId && r.personId.trim() !== ''
        const hasExternalId = r.externalId && r.externalId.trim() !== ''

        // Need update if one is missing but the other exists
        return (hasPersonId && !hasExternalId) || (!hasPersonId && hasExternalId)
    })

    console.log(`Found ${needsUpdate.length} residents that need syncing`)

    if (needsUpdate.length === 0) {
        console.log('All residents are already in sync!')
        return
    }

    // Update residents
    let updated = 0
    let errors = 0

    for (const resident of needsUpdate) {
        try {
            const hasPersonId = resident.personId && resident.personId.trim() !== ''
            const hasExternalId = resident.externalId && resident.externalId.trim() !== ''

            const updateData: any = { id: resident.id }

            if (hasPersonId && !hasExternalId) {
                // Copy personId to externalId
                updateData.externalId = resident.personId
                console.log(`Updating resident ${resident.id}: copying personId "${resident.personId}" to externalId`)
            } else if (!hasPersonId && hasExternalId) {
                // Copy externalId to personId
                updateData.personId = resident.externalId
                console.log(`Updating resident ${resident.id}: copying externalId "${resident.externalId}" to personId`)
            }

            await client.models.Resident.update(updateData)
            updated++

            // Log progress every 100 updates
            if (updated % 100 === 0) {
                console.log(`Progress: ${updated}/${needsUpdate.length}`)
            }

        } catch (error) {
            console.error(`Error updating resident ${resident.id}:`, error)
            errors++
        }
    }

    console.log('\nSync complete!')
    console.log(`Successfully updated: ${updated}`)
    console.log(`Errors: ${errors}`)
}

syncPersonIds()
    .then(() => {
        console.log('Done!')
        process.exit(0)
    })
    .catch(error => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
