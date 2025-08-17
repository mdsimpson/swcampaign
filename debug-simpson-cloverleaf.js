import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function debugSimpsonCloverleaf() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== DEBUGGING MICHAEL SIMPSON & CLOVERLEAF ===')
        
        // First, search for Michael Simpson
        console.log('1. Looking for Michael Simpson...')
        const peopleResult = await client.models.Person.list({ limit: 1000 })
        console.log(`Checking ${peopleResult.data.length} people...`)
        
        const simpsons = peopleResult.data.filter(person => 
            (person.firstName && person.firstName.toLowerCase().includes('michael')) ||
            (person.lastName && person.lastName.toLowerCase().includes('simpson'))
        )
        
        console.log(`Found ${simpsons.length} people with Simpson/Michael:`)
        simpsons.forEach(person => {
            console.log(`  - ${person.firstName} ${person.lastName} (Home ID: ${person.homeId})`)
        })
        
        // Now look for Oya Simpson
        console.log('\n2. Looking for Oya Simpson...')
        const oyas = peopleResult.data.filter(person => 
            (person.firstName && person.firstName.toLowerCase().includes('oya')) ||
            (person.lastName && person.lastName.toLowerCase().includes('simpson'))
        )
        
        console.log(`Found ${oyas.length} people with Oya/Simpson:`)
        oyas.forEach(person => {
            console.log(`  - ${person.firstName} ${person.lastName} (Home ID: ${person.homeId})`)
        })
        
        // Find all unique home IDs from Simpsons
        const simpsonHomeIds = [...new Set([...simpsons, ...oyas].map(p => p.homeId))]
        console.log(`\n3. Checking homes for Simpson family (${simpsonHomeIds.length} unique home IDs)...`)
        
        for (const homeId of simpsonHomeIds) {
            try {
                const homeResult = await client.models.Home.get({ id: homeId })
                if (homeResult.data) {
                    const home = homeResult.data
                    console.log(`\nHome: ${home.street}, ${home.city}`)
                    console.log(`  ID: ${home.id}`)
                    console.log(`  Is Cloverleaf: ${home.street && home.street.toLowerCase().includes('cloverleaf')}`)
                    
                    // Get all residents for this home
                    const residents = peopleResult.data.filter(p => p.homeId === homeId)
                    console.log(`  Residents: ${residents.length}`)
                    residents.forEach(person => {
                        console.log(`    - ${person.firstName} ${person.lastName} (${person.role})`)
                    })
                } else {
                    console.log(`Home ${homeId}: NOT FOUND`)
                }
            } catch (error) {
                console.log(`Home ${homeId}: ERROR - ${error.message}`)
            }
        }
        
        // Also specifically look for 42927 Cloverleaf Ct
        console.log('\n4. Looking specifically for 42927 Cloverleaf Ct...')
        
        let found42927 = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                if (home.street && home.street.includes('42927') && home.street.toLowerCase().includes('cloverleaf')) {
                    found42927.push(home)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken && found42927.length < 5)
        
        console.log(`Found ${found42927.length} homes matching "42927 Cloverleaf"`)
        
        for (const home of found42927) {
            console.log(`\n42927 Cloverleaf Home: ${home.street}`)
            console.log(`  ID: ${home.id}`)
            
            // Check residents
            const residents = peopleResult.data.filter(p => p.homeId === home.id)
            console.log(`  Residents: ${residents.length}`)
            residents.forEach(person => {
                console.log(`    - ${person.firstName} ${person.lastName} (${person.role})`)
            })
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

debugSimpsonCloverleaf()