import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function testOrganizePageLogic() {
    try {
        console.log('=== Testing Organize Page Logic ===')
        
        // Using the same auth mode as the updated Organize page
        const client = generateClient({ authMode: 'apiKey' })
        
        // Mimic the loadData function from Organize page
        console.log('Loading homes (non-absentee)...')
        
        let homeFilter = { absenteeOwner: { ne: true } }
        const pageSize = 20
        
        const homesResult = await client.models.Home.list({
            filter: homeFilter,
            limit: pageSize
        })
        
        const loadedHomes = homesResult.data
        console.log(`Found ${loadedHomes.length} non-absentee homes`)
        
        // Load related data for each home (like the UI does)
        const homesWithDetails = await Promise.all(
            loadedHomes.map(async (home) => {
                const [residentsResult, consentsResult, assignmentsResult] = await Promise.all([
                    client.models.Person.list({ filter: { homeId: { eq: home.id } } }),
                    client.models.Consent.list({ filter: { homeId: { eq: home.id } } }),
                    client.models.Assignment.list({ filter: { homeId: { eq: home.id } } })
                ])
                
                const residents = residentsResult.data
                const consents = consentsResult.data
                const assignments = assignmentsResult.data.filter(a => a.status !== 'DONE')
                
                // Determine consent status
                const allOwnersSigned = residents.length > 0 && 
                    residents.every(resident => resident.hasSigned)
                
                return { 
                    ...home, 
                    residents, 
                    consents,
                    assignments,
                    consentStatus: allOwnersSigned ? 'complete' : 'incomplete'
                }
            })
        )
        
        console.log('\nHomes with their residents:')
        homesWithDetails.forEach((home, i) => {
            const addressDisplay = home.unitNumber && home.street && home.unitNumber !== home.street 
                ? `${home.unitNumber} ${home.street}` 
                : (home.street || home.unitNumber)
            
            console.log(`${i+1}. ${addressDisplay}, ${home.city}, ${home.state}`)
            console.log(`   Residents (${home.residents.length}):`)
            if (home.residents.length > 0) {
                home.residents.forEach(resident => {
                    console.log(`      - ${resident.firstName} ${resident.lastName} (${resident.role}) - Signed: ${resident.hasSigned}`)
                })
            } else {
                console.log(`      - No residents`)
            }
            console.log(`   Consent Status: ${home.consentStatus}`)
            console.log(`   Assignments: ${home.assignments.length}`)
            console.log()
        })
        
        console.log(`\nSUMMARY:`)
        console.log(`Total homes: ${homesWithDetails.length}`)
        console.log(`Homes with residents: ${homesWithDetails.filter(h => h.residents.length > 0).length}`)
        console.log(`Homes without residents: ${homesWithDetails.filter(h => h.residents.length === 0).length}`)
        
    } catch (error) {
        console.error('Error testing organize page logic:', error)
    }
}

async function testAbsenteePageLogic() {
    try {
        console.log('\n=== Testing Absentee Page Logic ===')
        
        // Using the same auth mode as the updated AbsenteeInteractions page
        const client = generateClient({ authMode: 'apiKey' })
        
        // Mimic the loadAbsenteeHomes function
        console.log('Loading absentee homes...')
        
        let homeFilter = { absenteeOwner: { eq: true } }
        const pageSize = 20
        
        const result = await client.models.Home.list({
            filter: homeFilter,
            limit: pageSize
        })
        
        // Load residents for each home
        const homesWithResidents = await Promise.all(
            result.data.map(async (home) => {
                const residentsResult = await client.models.Person.list({
                    filter: { homeId: { eq: home.id } }
                })
                return { ...home, residents: residentsResult.data }
            })
        )
        
        console.log(`Found ${homesWithResidents.length} absentee homes`)
        
        homesWithResidents.forEach((home, i) => {
            const propertyAddress = home.unitNumber && home.street && home.unitNumber !== home.street 
                ? `${home.unitNumber} ${home.street}` 
                : (home.street || home.unitNumber)
                
            console.log(`${i+1}. Property: ${propertyAddress}, ${home.city}, ${home.state}`)
            console.log(`   Mailing: ${home.mailingStreet}, ${home.mailingCity}, ${home.mailingState}`)
            console.log(`   Residents (${home.residents.length}):`)
            if (home.residents.length > 0) {
                home.residents.forEach(resident => {
                    console.log(`      - ${resident.firstName} ${resident.lastName} (${resident.role})`)
                })
            } else {
                console.log(`      - No residents`)
            }
            console.log()
        })
        
    } catch (error) {
        console.error('Error testing absentee page logic:', error)
    }
}

async function main() {
    await testOrganizePageLogic()
    await testAbsenteePageLogic()
    process.exit(0)
}

main()