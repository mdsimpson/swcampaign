// Check which former owners have signed consents in the production system
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../amplify/data/resource'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'
import Papa from 'papaparse'
import fs from 'fs'

Amplify.configure(outputs)
const client = generateClient<Schema>()

async function main() {
    console.log('🔍 Checking which former owners have signed consents...\n')

    try {
        // Read former owners CSV
        const csvText = fs.readFileSync('.data/former_owers.csv', 'utf-8')
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
        const formerOwners = parsed.data as any[]

        console.log(`📋 Loaded ${formerOwners.length} former owners from CSV\n`)

        // Load all residents
        console.log('📥 Loading all residents from database...')
        let allResidents: any[] = []
        let nextToken = null

        do {
            const result = await client.models.Resident.list({
                limit: 1000,
                nextToken: nextToken
            })
            allResidents.push(...result.data)
            nextToken = result.nextToken
        } while (nextToken)

        console.log(`✅ Loaded ${allResidents.length} residents\n`)

        // Load all consents
        console.log('📥 Loading all consents from database...')
        let allConsents: any[] = []
        nextToken = null

        do {
            const result = await client.models.Consent.list({
                limit: 1000,
                nextToken: nextToken
            })
            allConsents.push(...result.data)
            nextToken = result.nextToken
        } while (nextToken)

        console.log(`✅ Loaded ${allConsents.length} consents\n`)

        // Create a Set of residentIds with consents
        const residentsWithConsents = new Set(allConsents.map(c => c.residentId))

        // Check each former owner
        console.log('=' .repeat(80))
        console.log('FORMER OWNERS CONSENT STATUS:')
        console.log('='.repeat(80))

        let foundInDB = 0
        let notFoundInDB = 0
        let hasSigned = 0
        let notSigned = 0

        const signedList: any[] = []
        const notSignedList: any[] = []
        const notFoundList: any[] = []

        for (const owner of formerOwners) {
            const personId = owner.person_id?.trim()
            const firstName = owner['Occupant First Name']?.trim()
            const lastName = owner['Occupant Last Name']?.trim()

            if (!personId || !firstName || !lastName) {
                continue
            }

            // Find resident by externalId (person_id)
            const resident = allResidents.find(r => r.externalId === personId)

            if (resident) {
                foundInDB++
                const hasConsent = residentsWithConsents.has(resident.id)

                if (hasConsent) {
                    hasSigned++
                    const consent = allConsents.find(c => c.residentId === resident.id)
                    signedList.push({
                        personId,
                        name: `${firstName} ${lastName}`,
                        email: consent?.email || 'N/A',
                        source: consent?.source || 'N/A',
                        recordedAt: consent?.recordedAt || 'N/A'
                    })
                    console.log(`✅ SIGNED: ${firstName} ${lastName} (ID: ${personId})`)
                } else {
                    notSigned++
                    notSignedList.push({
                        personId,
                        name: `${firstName} ${lastName}`
                    })
                    console.log(`❌ NOT SIGNED: ${firstName} ${lastName} (ID: ${personId})`)
                }
            } else {
                notFoundInDB++
                notFoundList.push({
                    personId,
                    name: `${firstName} ${lastName}`
                })
                console.log(`⚠️  NOT IN DB: ${firstName} ${lastName} (ID: ${personId})`)
            }
        }

        console.log('\n' + '='.repeat(80))
        console.log('SUMMARY:')
        console.log('='.repeat(80))
        console.log(`Total former owners in CSV: ${formerOwners.length}`)
        console.log(`Found in database: ${foundInDB}`)
        console.log(`Not found in database: ${notFoundInDB}`)
        console.log(`\nOf those found in database:`)
        console.log(`  ✅ Have signed: ${hasSigned}`)
        console.log(`  ❌ Have NOT signed: ${notSigned}`)
        console.log('='.repeat(80))

        if (signedList.length > 0) {
            console.log('\n📝 FORMER OWNERS WHO SIGNED:')
            console.log('-'.repeat(80))
            signedList.forEach(s => {
                console.log(`  ${s.name} (ID: ${s.personId})`)
                console.log(`    Email: ${s.email}`)
                console.log(`    Source: ${s.source}`)
                console.log(`    Recorded: ${s.recordedAt}`)
            })
        }

        if (notFoundList.length > 0) {
            console.log('\n⚠️  FORMER OWNERS NOT IN DATABASE:')
            console.log('-'.repeat(80))
            notFoundList.forEach(n => {
                console.log(`  ${n.name} (ID: ${n.personId})`)
            })
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message || error)
    }
}

main()
