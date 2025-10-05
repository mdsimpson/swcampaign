import * as fs from 'fs'
import * as path from 'path'

interface BillingAddress {
    street: string
    city: string
    state: string
    zip: string
    isDifferentFromProperty: boolean
}

interface Resident {
    id: string
    firstName: string
    lastName: string
    occupantType: string
    street: string
    city: string
    state: string
    zip: string
    addressId: string
    contactEmail: string
    additionalEmail: string
    cellPhone: string
    cellPhoneAlert: string
    unitPhone: string
    workPhone: string
    isAbsentee: string
}

function normalizeAddress(address: string): string {
    return address
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim()
}

function normalizeCity(city: string): string {
    // Handle Ashburn/Broadlands equivalency
    const normalized = city.toLowerCase().trim()
    if (normalized === 'ashburn' || normalized === 'broadlands') {
        return 'ashburn/broadlands'
    }
    return normalized
}

async function main() {
    const billingAddressesPath = path.join(process.cwd(), 'src/data/billingAddresses.json')
    const residents2Path = path.join(process.cwd(), '.data/residents2.csv')
    
    // Load billing addresses
    const billingAddresses: Record<string, BillingAddress> = JSON.parse(
        fs.readFileSync(billingAddressesPath, 'utf8')
    )
    
    // Load residents2.csv
    const residents2Content = fs.readFileSync(residents2Path, 'utf8')
    const residents2Lines = residents2Content.split('\n').slice(1) // Skip header
    
    const residents: Resident[] = residents2Lines
        .filter(line => line.trim())
        .map(line => {
            const [id, firstName, lastName, occupantType, street, city, state, zip, addressId, contactEmail, additionalEmail, cellPhone, cellPhoneAlert, unitPhone, workPhone, isAbsentee] = line.split(',')
            return {
                id: id.trim(),
                firstName: firstName?.trim() || '',
                lastName: lastName?.trim() || '',
                occupantType: occupantType?.trim() || '',
                street: street?.trim() || '',
                city: city?.trim() || '',
                state: state?.trim() || '',
                zip: zip?.trim() || '',
                addressId: addressId?.trim() || '',
                contactEmail: contactEmail?.trim() || '',
                additionalEmail: additionalEmail?.trim() || '',
                cellPhone: cellPhone?.trim() || '',
                cellPhoneAlert: cellPhoneAlert?.trim() || '',
                unitPhone: unitPhone?.trim() || '',
                workPhone: workPhone?.trim() || '',
                isAbsentee: isAbsentee?.trim() || 'false'
            }
        })
    
    const discrepancies: Array<{
        resident: Resident
        billing: BillingAddress | null
        issue: string
    }> = []
    
    // Check each resident marked as absentee
    const absenteeResidents = residents.filter(r => r.isAbsentee === 'true')
    
    console.log(`Checking ${absenteeResidents.length} residents marked as absentee...`)
    
    for (const resident of absenteeResidents) {
        const nameKey = `${resident.firstName.toLowerCase()} ${resident.lastName.toLowerCase()}`
        const billing = billingAddresses[nameKey]
        
        if (!billing) {
            discrepancies.push({
                resident,
                billing: null,
                issue: 'No billing address found'
            })
            continue
        }
        
        if (!billing.isDifferentFromProperty) {
            // Check if addresses are actually the same
            const residentAddr = `${resident.street} ${resident.city} ${resident.state} ${resident.zip}`
            const billingAddr = `${billing.street} ${billing.city} ${billing.state} ${billing.zip}`
            
            const normalizedResident = normalizeAddress(residentAddr)
            const normalizedBilling = normalizeAddress(billingAddr)
            
            // Also check city equivalency
            const residentCityNorm = normalizeCity(resident.city)
            const billingCityNorm = normalizeCity(billing.city)
            
            if (normalizedResident === normalizedBilling || 
                (resident.street === billing.street && 
                 residentCityNorm === billingCityNorm && 
                 resident.state === billing.state && 
                 resident.zip === billing.zip)) {
                
                discrepancies.push({
                    resident,
                    billing,
                    issue: `Marked as absentee but billing address is same/equivalent (billing.isDifferentFromProperty: false). Property: "${residentAddr}", Billing: "${billingAddr}"`
                })
            }
        }
    }
    
    // Print results
    if (discrepancies.length === 0) {
        console.log('No discrepancies found!')
        return
    }
    
    console.log(`\nFound ${discrepancies.length} discrepancies:\n`)
    
    discrepancies.forEach((disc, index) => {
        console.log(`${index + 1}. ${disc.resident.firstName} ${disc.resident.lastName}`)
        console.log(`   Property: ${disc.resident.street}, ${disc.resident.city}, ${disc.resident.state} ${disc.resident.zip}`)
        if (disc.billing) {
            console.log(`   Billing: ${disc.billing.street}, ${disc.billing.city}, ${disc.billing.state} ${disc.billing.zip}`)
        }
        console.log(`   Issue: ${disc.issue}`)
        console.log(`   Resident ID: ${disc.resident.id}`)
        console.log()
    })
    
    // Write discrepancies to file for fixing
    const fixData = discrepancies.map(disc => ({
        residentId: disc.resident.id,
        firstName: disc.resident.firstName,
        lastName: disc.resident.lastName,
        shouldBeAbsentee: false,
        currentIsAbsentee: disc.resident.isAbsentee === 'true'
    }))
    
    fs.writeFileSync(
        path.join(process.cwd(), 'scripts/absentee-fixes.json'),
        JSON.stringify(fixData, null, 2)
    )
    
    console.log(`Fix data written to scripts/absentee-fixes.json`)
}

main().catch(console.error)