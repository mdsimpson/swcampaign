import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function findAnyCloverleafResidents() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== FINDING ANY RESIDENTS AT CLOVERLEAF ADDRESSES ===')
        
        // Get all Cloverleaf homes
        let cloverleafHomes = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken
            })
            
            for (const home of result.data) {
                if (home.street && home.street.toLowerCase().includes('cloverleaf')) {
                    cloverleafHomes.push(home)
                }
            }
            
            nextToken = result.nextToken
        } while (nextToken && cloverleafHomes.length < 50)
        
        console.log(`Found ${cloverleafHomes.length} Cloverleaf homes`)
        
        // Get all people
        const allPeople = await client.models.Person.list({ limit: 1000 })
        console.log(`Found ${allPeople.data.length} total people`)
        
        // Check each Cloverleaf home for residents
        let totalResidents = 0
        
        for (const home of cloverleafHomes) {
            const residents = allPeople.data.filter(p => p.homeId === home.id)
            
            if (residents.length > 0) {
                console.log(`\n${home.street}, ${home.city} (ID: ${home.id})`)
                console.log(`  Residents: ${residents.length}`)
                residents.forEach(person => {
                    console.log(`    - ${person.firstName} ${person.lastName} (${person.role})`)
                })
                totalResidents += residents.length
            }
        }
        
        console.log(`\n=== SUMMARY ===`)
        console.log(`Total Cloverleaf homes: ${cloverleafHomes.length}`)
        console.log(`Total residents at Cloverleaf addresses: ${totalResidents}`)
        
        // Also check the CSV file to see what should be there
        console.log('\n=== CHECKING CSV FOR CLOVERLEAF DATA ===')
        
        if (fs.existsSync('.data/Homeowner2.csv')) {
            const csvContent = fs.readFileSync('.data/Homeowner2.csv', 'utf8')
            const csvLines = csvContent.split('\n')
            
            console.log(`CSV has ${csvLines.length} lines`)
            
            let cloverleafCount = 0
            csvLines.forEach((line, i) => {
                if (line.toLowerCase().includes('cloverleaf')) {
                    cloverleafCount++
                    if (cloverleafCount <= 5) {
                        console.log(`CSV Line ${i + 1}: ${line.substring(0, 200)}...`)
                    }
                }
            })
            
            console.log(`Found ${cloverleafCount} Cloverleaf entries in CSV`)
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

findAnyCloverleafResidents()