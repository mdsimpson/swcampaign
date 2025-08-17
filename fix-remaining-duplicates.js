import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function fixRemainingDuplicates() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== FIXING REMAINING DUPLICATES ===')
        
        // Get ALL homes
        let allHomes = []
        let nextToken = null
        
        do {
            const result = await client.models.Home.list({
                limit: 1000,
                nextToken
            })
            allHomes.push(...result.data)
            nextToken = result.nextToken
        } while (nextToken)
        
        console.log(`Found ${allHomes.length} total homes`)
        
        // Group by exact address
        const homesByAddress = {}
        
        for (const home of allHomes) {
            const address = `${home.street?.toLowerCase().trim()}, ${home.city?.toLowerCase().trim()}`
            if (!homesByAddress[address]) {
                homesByAddress[address] = []
            }
            homesByAddress[address].push(home)
        }
        
        const addresses = Object.keys(homesByAddress)
        console.log(`Found ${addresses.length} unique addresses`)
        
        // Find all duplicates
        const duplicatedAddresses = addresses.filter(addr => homesByAddress[addr].length > 1)
        console.log(`Addresses with duplicates: ${duplicatedAddresses.length}`)
        
        if (duplicatedAddresses.length === 0) {
            console.log('No duplicates found!')
            return
        }
        
        // Get all people for reference
        let allPeople = []
        let peopleNextToken = null
        
        do {
            const result = await client.models.Person.list({
                limit: 1000,
                nextToken: peopleNextToken
            })
            allPeople.push(...result.data)
            peopleNextToken = result.nextToken
        } while (peopleNextToken)
        
        console.log(`Found ${allPeople.length} total people`)
        
        // Process duplicates
        let homesToDelete = []
        let peopleToUpdate = []
        let peopleToDelete = []
        
        for (const addr of duplicatedAddresses) {
            const homes = homesByAddress[addr]
            
            // Sort by creation date (keep the newest)
            homes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            
            const keepHome = homes[0]
            const deleteHomes = homes.slice(1)
            
            console.log(`${addr}: keeping ${keepHome.id.substring(0, 8)}... (${keepHome.createdAt}), deleting ${deleteHomes.length} older copies`)
            
            homesToDelete.push(...deleteHomes)
            
            // Handle people for deleted homes
            for (const deleteHome of deleteHomes) {
                const peopleInDeleteHome = allPeople.filter(p => p.homeId === deleteHome.id)
                
                for (const person of peopleInDeleteHome) {
                    // Check if there's already a person with same name in the keep home
                    const existingPerson = allPeople.find(p => 
                        p.homeId === keepHome.id && 
                        p.firstName === person.firstName && 
                        p.lastName === person.lastName
                    )
                    
                    if (existingPerson) {
                        // Delete duplicate person
                        peopleToDelete.push(person)
                    } else {
                        // Move person to keep home
                        peopleToUpdate.push({
                            person,
                            newHomeId: keepHome.id
                        })
                    }
                }
            }
        }
        
        console.log(`\nPlan:`)
        console.log(`Homes to delete: ${homesToDelete.length}`)
        console.log(`People to move: ${peopleToUpdate.length}`)
        console.log(`People to delete: ${peopleToDelete.length}`)
        
        // Execute deletions and updates
        console.log(`\n=== UPDATING PEOPLE ===`)
        
        for (let i = 0; i < peopleToUpdate.length; i++) {
            const { person, newHomeId } = peopleToUpdate[i]
            try {
                await client.models.Person.update({
                    id: person.id,
                    homeId: newHomeId
                })
                if (i < 5) {
                    console.log(`Moved ${person.firstName} ${person.lastName} to kept home`)
                }
            } catch (error) {
                console.error(`Error updating person ${person.id}:`, error.message)
            }
        }
        
        console.log(`Updated ${peopleToUpdate.length} people`)
        
        console.log(`\n=== DELETING DUPLICATE PEOPLE ===`)
        
        for (let i = 0; i < peopleToDelete.length; i++) {
            const person = peopleToDelete[i]
            try {
                await client.models.Person.delete({ id: person.id })
                if (i < 5) {
                    console.log(`Deleted duplicate person: ${person.firstName} ${person.lastName}`)
                }
            } catch (error) {
                console.error(`Error deleting person ${person.id}:`, error.message)
            }
        }
        
        console.log(`Deleted ${peopleToDelete.length} duplicate people`)
        
        console.log(`\n=== DELETING DUPLICATE HOMES ===`)
        
        const batchSize = 10
        let homesDeleted = 0
        
        for (let i = 0; i < homesToDelete.length; i += batchSize) {
            const batch = homesToDelete.slice(i, i + batchSize)
            
            const deletePromises = batch.map(async (home) => {
                try {
                    await client.models.Home.delete({ id: home.id })
                    return true
                } catch (error) {
                    console.error(`Error deleting home ${home.id}:`, error.message)
                    return false
                }
            })
            
            const results = await Promise.all(deletePromises)
            const successful = results.filter(r => r).length
            homesDeleted += successful
            
            console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}: ${successful}/${batch.length} homes (${homesDeleted}/${homesToDelete.length} total)`)
            
            // Small delay
            if (i + batchSize < homesToDelete.length) {
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }
        
        console.log(`\n=== FINAL CLEANUP COMPLETE ===`)
        console.log(`Total homes deleted: ${homesDeleted}`)
        console.log(`Expected remaining homes: ${allHomes.length - homesDeleted}`)
        console.log(`Expected remaining people: ${allPeople.length - peopleToDelete.length}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

fixRemainingDuplicates()