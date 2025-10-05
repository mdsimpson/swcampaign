// Remove duplicate consent records, keeping only one per resident
import fetch from 'node-fetch'

const GRAPHQL_ENDPOINT = "https://2evbycyqcrcadnfqs2q6vpuahu.appsync-api.us-east-1.amazonaws.com/graphql"
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
        console.error('GraphQL errors:', JSON.stringify(result.errors, null, 2))
        throw new Error(JSON.stringify(result.errors))
    }
    return result.data
}

async function main() {
    console.log('🔍 Finding and removing duplicate consent records...\n')

    try {
        // Load all consents
        console.log('Loading all consents...')
        let allConsents: any[] = []
        let nextToken = null

        const listQuery = `
            query ListConsents($limit: Int, $nextToken: String) {
                listConsents(limit: $limit, nextToken: $nextToken) {
                    items {
                        id
                        residentId
                        addressId
                        source
                        email
                        recordedAt
                        createdAt
                    }
                    nextToken
                }
            }
        `

        do {
            const result = await graphqlRequest(listQuery, {
                limit: 1000,
                nextToken: nextToken
            })
            allConsents.push(...result.listConsents.items)
            nextToken = result.listConsents.nextToken
            if (nextToken) {
                console.log(`  Loaded ${allConsents.length} consents so far...`)
            }
        } while (nextToken)

        console.log(`\n✅ Loaded ${allConsents.length} total consents\n`)

        // Group by residentId
        const consentsByResident = new Map<string, any[]>()

        for (const consent of allConsents) {
            const residentId = consent.residentId
            if (!consentsByResident.has(residentId)) {
                consentsByResident.set(residentId, [])
            }
            consentsByResident.get(residentId)!.push(consent)
        }

        console.log(`📊 Found consents for ${consentsByResident.size} unique residents\n`)

        // Find duplicates
        const duplicates: any[] = []
        for (const [residentId, consents] of consentsByResident.entries()) {
            if (consents.length > 1) {
                duplicates.push({ residentId, consents })
            }
        }

        console.log(`⚠️  Found ${duplicates.length} residents with duplicate consents:\n`)

        if (duplicates.length === 0) {
            console.log('✅ No duplicates found!')
            return
        }

        // Show some examples
        console.log('Examples of duplicates:')
        duplicates.slice(0, 5).forEach(({ residentId, consents }) => {
            console.log(`  Resident ${residentId}: ${consents.length} consents`)
            consents.forEach((c: any) => {
                console.log(`    - ID: ${c.id}, Source: ${c.source}, Email: ${c.email || 'N/A'}, Created: ${c.createdAt}`)
            })
        })

        console.log(`\n🗑️  Will delete ${duplicates.reduce((sum, d) => sum + d.consents.length - 1, 0)} duplicate consents...\n`)

        let deletedCount = 0

        for (const { residentId, consents } of duplicates) {
            // Sort by createdAt to keep the most recent, or if no createdAt, keep the one with email
            const sorted = consents.sort((a, b) => {
                // Prefer one with email
                if (a.email && !b.email) return -1
                if (!a.email && b.email) return 1

                // Then by creation date (most recent first)
                if (a.createdAt && b.createdAt) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                }

                return 0
            })

            // Keep the first one (most recent or with email), delete the rest
            const toKeep = sorted[0]
            const toDelete = sorted.slice(1)

            console.log(`Resident ${residentId}: Keeping consent ${toKeep.id}, deleting ${toDelete.length} duplicates...`)

            const deleteMutation = `
                mutation DeleteConsent($id: ID!) {
                    deleteConsent(input: { id: $id }) {
                        id
                    }
                }
            `

            for (const consent of toDelete) {
                await graphqlRequest(deleteMutation, { id: consent.id })
                deletedCount++

                if (deletedCount % 50 === 0) {
                    console.log(`  Deleted ${deletedCount} duplicates so far...`)
                }
            }
        }

        console.log(`\n✅ Successfully deleted ${deletedCount} duplicate consents!`)
        console.log(`📊 Remaining consents: ${allConsents.length - deletedCount}`)

    } catch (error: any) {
        console.error('❌ Error:', error.message || error)
    }
}

main()
