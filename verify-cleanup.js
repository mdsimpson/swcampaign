import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function verifyCleanup() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== VERIFYING CLEANUP RESULTS ===')
        
        // Check home counts
        let totalHomes = 0
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 1000,
                nextToken
            })
            totalHomes += result.data.length
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Total homes after cleanup: ${totalHomes}`)
        console.log(`Expected: ~3,248 homes`)
        
        // Check people counts
        let totalPeople = 0
        let peopleNextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken: peopleNextToken
            })
            totalPeople += result.data.length
            peopleNextToken = result.nextToken
        } while (peopleNextToken)
        
        console.log(`Total people after cleanup: ${totalPeople}`)
        console.log(`Expected: ~5,820 people`)
        
        // Check homes with residents count
        let allPeople = []
        peopleNextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken: peopleNextToken
            })
            allPeople.push(...result.data)
            peopleNextToken = result.nextToken
        } while (peopleNextToken)
        
        const homeIdsWithResidents = [...new Set(allPeople.map(p => p.homeId))]
        console.log(`Homes with residents: ${homeIdsWithResidents.length}`)
        
        // Test Cloverleaf search
        console.log('\n=== TESTING CLOVERLEAF SEARCH ===')
        
        let cloverleafHomes = []
        let searchNextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 200,
                nextToken: searchNextToken
            })
            
            for (const home of result.data) {
                if (home.street?.toLowerCase().includes('cloverleaf')) {
                    cloverleafHomes.push(home)
                }
            }
            
            searchNextToken = result.nextToken
        } while (searchNextToken && cloverleafHomes.length < 50)
        
        console.log(`Cloverleaf homes found: ${cloverleafHomes.length}`)
        console.log(`Expected: ~17 unique Cloverleaf homes`)
        
        // Check for duplicates in Cloverleaf results
        const cloverleafAddresses = cloverleafHomes.map(h => `${h.street}, ${h.city}`.toLowerCase())
        const uniqueCloverleafAddresses = [...new Set(cloverleafAddresses)]
        
        if (cloverleafAddresses.length === uniqueCloverleafAddresses.length) {
            console.log('✅ No duplicate Cloverleaf addresses found')
        } else {
            console.log(`❌ Still have ${cloverleafAddresses.length - uniqueCloverleafAddresses.length} duplicate Cloverleaf addresses`)
        }
        
        // Test Michael Simpson specifically
        const simpsonHome = cloverleafHomes.find(h => h.street?.includes('42927'))
        if (simpsonHome) {
            const simpsonResidents = allPeople.filter(p => p.homeId === simpsonHome.id)
            console.log(`\n✅ Michael Simpson's home found: ${simpsonHome.street}`)
            console.log(`Residents: ${simpsonResidents.length}`)
            simpsonResidents.forEach(person => {
                console.log(`  - ${person.firstName} ${person.lastName} (${person.role})`)
            })
        } else {
            console.log('\n❌ Michael Simpson\'s home not found')
        }
        
        // Summary
        console.log('\n=== SUMMARY ===')
        const homeCountGood = Math.abs(totalHomes - 3248) < 100
        const peopleCountGood = Math.abs(totalPeople - 5820) < 200
        const cloverleafGood = cloverleafHomes.length >= 15 && cloverleafHomes.length <= 20
        
        console.log(`Homes count: ${homeCountGood ? '✅' : '❌'} ${totalHomes}`)
        console.log(`People count: ${peopleCountGood ? '✅' : '❌'} ${totalPeople}`)
        console.log(`Cloverleaf search: ${cloverleafGood ? '✅' : '❌'} ${cloverleafHomes.length}`)
        
        if (homeCountGood && peopleCountGood && cloverleafGood) {
            console.log('\n🎉 CLEANUP SUCCESSFUL! Database is now clean.')
        } else {
            console.log('\n⚠️ Some issues remain. May need additional cleanup.')
        }
        
    } catch (error) {
        console.error('Error:', error)
    }
}

verifyCleanup()