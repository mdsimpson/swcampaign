// Delete all residents from production database
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://bwng3ppgdfhl5cnfzv3difc4vm.appsync-api.us-east-1.amazonaws.com/graphql"
const API_KEY = "da2-mgxvgdjuffbvpcz4gljvulnw4m"

async function graphqlRequest(query: string, variables: any = {}) {
    const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({ query, variables })
    })

    const result = await response.json()
    if (result.errors) {
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function listAllResidents() {
    const query = `
        query ListResidents($limit: Int, $nextToken: String) {
            listResidents(limit: $limit, nextToken: $nextToken) {
                items {
                    id
                }
                nextToken
            }
        }
    `

    let allResidents: any[] = []
    let nextToken = null

    do {
        const data = await graphqlRequest(query, { limit: 1000, nextToken })
        allResidents = allResidents.concat(data.listResidents.items)
        nextToken = data.listResidents.nextToken
        console.log(`Fetched ${allResidents.length} residents so far...`)
    } while (nextToken)

    return allResidents
}

async function deleteResident(id: string) {
    const mutation = `
        mutation DeleteResident($input: DeleteResidentInput!) {
            deleteResident(input: $input) {
                id
            }
        }
    `
    const data = await graphqlRequest(mutation, {
        input: { id }
    })
    return data.deleteResident
}

async function main() {
    console.log('🗑️  Deleting all residents from production database...\n')

    try {
        // List all residents
        console.log('📋 Fetching all residents...')
        const residents = await listAllResidents()
        console.log(`\nFound ${residents.length} residents to delete\n`)

        if (residents.length === 0) {
            console.log('No residents to delete')
            return
        }

        // Confirm deletion
        console.log('⚠️  WARNING: This will delete ALL residents from the production database!')
        console.log('This action cannot be undone.\n')

        // Delete all residents
        console.log('🔄 Deleting residents...')
        let deleted = 0
        let errors = 0

        for (const resident of residents) {
            try {
                await deleteResident(resident.id)
                deleted++
                if (deleted % 100 === 0) {
                    console.log(`  Deleted ${deleted}/${residents.length} residents...`)
                }
            } catch (err) {
                console.error(`  Error deleting resident ${resident.id}:`, err)
                errors++
            }
        }

        console.log('\n' + '='.repeat(60))
        console.log('=== Deletion Complete ===')
        console.log(`Residents deleted: ${deleted}`)
        console.log(`Errors: ${errors}`)

        if (deleted > 0) {
            console.log('\n✅ All residents have been deleted from production!')
        }

    } catch (err) {
        console.error('Fatal error:', err)
        process.exit(1)
    }
}

main()
