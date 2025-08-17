import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import fs from 'fs'

const outputs = JSON.parse(fs.readFileSync('./amplify_outputs.json', 'utf8'))
Amplify.configure(outputs)

async function removeDuplicates() {
    try {
        const client = generateClient({ authMode: 'apiKey' })
        
        console.log('=== REMOVING DUPLICATE HOMES ===')
        
        // Get all homes
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
        
        // Group by address
        const homesByAddress = {}
        
        for (const home of allHomes) {
            const address = `${home.street}, ${home.city}`.toLowerCase().trim()
            if (!homesByAddress[address]) {
                homesByAddress[address] = []
            }
            homesByAddress[address].push(home)
        }
        
        const addresses = Object.keys(homesByAddress)
        console.log(`Found ${addresses.length} unique addresses`)
        
        // Find homes to delete (keep the newest one for each address)
        const homesToDelete = []
        let keptHomes = 0
        
        for (const addr of addresses) {
            const homes = homesByAddress[addr]
            if (homes.length > 1) {
                // Sort by creation date (newest first)
                homes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                
                // Keep the first (newest), delete the rest
                const toKeep = homes[0]
                const toDelete = homes.slice(1)
                
                homesToDelete.push(...toDelete)
                keptHomes++
                
                if (homesToDelete.length < 10) {
                    console.log(`${addr}: keeping ${toKeep.id.substring(0, 8)}... (${toKeep.createdAt}), deleting ${toDelete.length} older copies`)
                }
            } else {
                keptHomes++
            }
        }
        
        console.log(`\nSummary:`)
        console.log(`Homes to keep: ${keptHomes}`)
        console.log(`Homes to delete: ${homesToDelete.length}`)
        console.log(`Expected final total: ${keptHomes}`)
        
        if (homesToDelete.length === 0) {
            console.log('No duplicates found to remove.')
            return
        }
        
        // Before deleting homes, we need to handle associated people
        console.log(`\n=== HANDLING ASSOCIATED PEOPLE ===`)
        
        // Get all people
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
        
        // For each home we're keeping, make sure all people from duplicate homes are moved to it
        let peopleUpdated = 0
        let peopleDeleted = 0
        
        for (const addr of addresses) {
            const homes = homesByAddress[addr]
            if (homes.length > 1) {
                // Sort by creation date (newest first)
                homes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                
                const keepHome = homes[0]
                const deleteHomes = homes.slice(1)
                
                // Find all people associated with homes we're deleting
                for (const deleteHome of deleteHomes) {
                    const peopleToMove = allPeople.filter(p => p.homeId === deleteHome.id)
                    
                    for (const person of peopleToMove) {
                        // Check if there's already a person with same name at the keep home
                        const existingPerson = allPeople.find(p => 
                            p.homeId === keepHome.id && 
                            p.firstName === person.firstName && 
                            p.lastName === person.lastName
                        )
                        
                        if (existingPerson) {
                            // Delete the duplicate person
                            try {
                                await client.models.Person.delete({ id: person.id })
                                peopleDeleted++
                                if (peopleDeleted <= 5) {
                                    console.log(`Deleted duplicate person: ${person.firstName} ${person.lastName}`)
                                }
                            } catch (error) {
                                console.error(`Error deleting person ${person.id}:`, error.message)
                            }
                        } else {
                            // Move person to the keep home
                            try {
                                await client.models.Person.update({
                                    id: person.id,
                                    homeId: keepHome.id
                                })
                                peopleUpdated++
                                if (peopleUpdated <= 5) {
                                    console.log(`Moved ${person.firstName} ${person.lastName} to kept home`)
                                }
                            } catch (error) {
                                console.error(`Error updating person ${person.id}:`, error.message)
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`People updated: ${peopleUpdated}`)
        console.log(`Duplicate people deleted: ${peopleDeleted}`)
        
        // Now delete the duplicate homes
        console.log(`\n=== DELETING DUPLICATE HOMES ===`)
        
        let homesDeleted = 0
        const batchSize = 10
        
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
            
            // Small delay to avoid overwhelming the API
            if (i + batchSize < homesToDelete.length) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }
        
        console.log(`\n=== CLEANUP COMPLETE ===`)
        console.log(`Homes deleted: ${homesDeleted}`)
        console.log(`Expected remaining homes: ${allHomes.length - homesDeleted}`)
        console.log(`Expected remaining people: ${allPeople.length - peopleDeleted}`)
        
    } catch (error) {
        console.error('Error:', error)
    }
}

removeDuplicates()