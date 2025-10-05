import Header from '../../components/Header'
import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'
import Papa from 'papaparse'

export default function DataManagement() {
    const [status, setStatus] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [stats, setStats] = useState({ residents: 0, addresses: 0, consents: 0 })
    const [addressFile, setAddressFile] = useState<File | null>(null)
    const [residentsFile, setResidentsFile] = useState<File | null>(null)
    const client = generateClient<Schema>()

    async function getStats() {
        setStatus('Loading statistics...')
        try {
            // Count residents with pagination
            let residentCount = 0
            let residentsToken = null
            do {
                const result = await client.models.Resident.list({ limit: 1000, nextToken: residentsToken })
                residentCount += result.data.length
                residentsToken = result.nextToken
            } while (residentsToken)

            // Count addresses with pagination
            let addressCount = 0
            let addressesToken = null
            do {
                const result = await client.models.Address.list({ limit: 1000, nextToken: addressesToken })
                addressCount += result.data.length
                addressesToken = result.nextToken
            } while (addressesToken)

            // Count consents with pagination
            let consentCount = 0
            let consentsToken = null
            do {
                const result = await client.models.Consent.list({ limit: 1000, nextToken: consentsToken })
                consentCount += result.data.length
                consentsToken = result.nextToken
            } while (consentsToken)

            setStats({
                residents: residentCount,
                addresses: addressCount,
                consents: consentCount
            })
            setStatus('Statistics loaded')
        } catch (error) {
            console.error('Error loading stats:', error)
            setStatus('Error loading statistics')
        }
    }

    async function deleteAllData() {
        if (!confirm('⚠️ WARNING: This will DELETE ALL residents, addresses, and consents from production! Are you sure?')) {
            return
        }

        try {
            setStatus('Deleting all data...')

            // Delete consents first
            setStatus('Deleting consents...')
            let consentsNextToken = null
            let deletedConsents = 0
            do {
                const consents = await client.models.Consent.list({ limit: 100, nextToken: consentsNextToken })
                for (const consent of consents.data) {
                    await client.models.Consent.delete({ id: consent.id })
                    deletedConsents++
                }
                consentsNextToken = consents.nextToken
                setProgress({ current: deletedConsents, total: deletedConsents })
            } while (consentsNextToken)

            // Delete assignments
            setStatus('Deleting assignments...')
            let assignmentsNextToken = null
            let deletedAssignments = 0
            do {
                const assignments = await client.models.Assignment.list({ limit: 100, nextToken: assignmentsNextToken })
                for (const assignment of assignments.data) {
                    await client.models.Assignment.delete({ id: assignment.id })
                    deletedAssignments++
                }
                assignmentsNextToken = assignments.nextToken
            } while (assignmentsNextToken)

            // Delete residents
            setStatus('Deleting residents...')
            let residentsNextToken = null
            let deletedResidents = 0
            do {
                const residents = await client.models.Resident.list({ limit: 100, nextToken: residentsNextToken })
                for (const resident of residents.data) {
                    await client.models.Resident.delete({ id: resident.id })
                    deletedResidents++
                    if (deletedResidents % 50 === 0) {
                        setProgress({ current: deletedResidents, total: deletedResidents })
                    }
                }
                residentsNextToken = residents.nextToken
            } while (residentsNextToken)

            // Delete addresses
            setStatus('Deleting addresses...')
            let addressesNextToken = null
            let deletedAddresses = 0
            do {
                const addresses = await client.models.Address.list({ limit: 100, nextToken: addressesNextToken })
                for (const address of addresses.data) {
                    await client.models.Address.delete({ id: address.id })
                    deletedAddresses++
                    if (deletedAddresses % 50 === 0) {
                        setProgress({ current: deletedAddresses, total: deletedAddresses })
                    }
                }
                addressesNextToken = addresses.nextToken
            } while (addressesNextToken)

            setStatus(`✅ Deleted all data! (${deletedConsents} consents, ${deletedAssignments} assignments, ${deletedResidents} residents, ${deletedAddresses} addresses)`)
            setProgress({ current: 0, total: 0 })
            await getStats()
        } catch (error) {
            console.error('Error deleting data:', error)
            setStatus(`❌ Error: ${error}`)
        }
    }

    async function importData() {
        if (!addressFile || !residentsFile) {
            alert('Please select both address2.csv and residents2.csv files')
            return
        }

        if (!confirm('⚠️ Import addresses and residents from CSV files? This will add to existing data.')) {
            return
        }

        try {
            // Parse address CSV
            setStatus('Parsing address file...')
            const addressText = await addressFile.text()
            const addressParsed = Papa.parse(addressText, { header: true, skipEmptyLines: true })
            const addresses = addressParsed.data as any[]

            // Parse residents CSV
            setStatus('Parsing residents file...')
            const residentsText = await residentsFile.text()
            const residentsParsed = Papa.parse(residentsText, { header: true, skipEmptyLines: true })
            const residents = residentsParsed.data as any[]

            console.log(`Parsed ${addresses.length} addresses and ${residents.length} residents`)

            // Import addresses
            setStatus('Importing addresses...')
            setProgress({ current: 0, total: addresses.length })
            const addressIdMap = new Map<string, string>()
            let addressCount = 0

            for (const address of addresses) {
                try {
                    const result = await client.models.Address.create({
                        externalId: address.id,
                        street: address.Street,
                        city: address.City || 'Ashburn',
                        state: address.State || 'VA',
                        zip: address.Zip,
                        lat: address.lat ? parseFloat(address.lat) : null,
                        lng: address.lng ? parseFloat(address.lng) : null
                    })

                    if (result.data?.id) {
                        addressIdMap.set(address.id, result.data.id)
                        addressCount++
                        if (addressCount % 50 === 0) {
                            setProgress({ current: addressCount, total: addresses.length })
                        }
                    }
                } catch (error: any) {
                    console.error(`Failed to import address ${address.Street}:`, error)
                }
            }

            setStatus(`✅ Imported ${addressCount} addresses. Now importing residents...`)

            // Import residents
            setProgress({ current: 0, total: residents.length })
            let residentCount = 0

            for (const resident of residents) {
                try {
                    const newAddressId = addressIdMap.get(resident.address_id)
                    if (!newAddressId) {
                        console.warn(`Skipping resident - address not found: ${resident['Occupant First Name']} ${resident['Occupant Last Name']}`)
                        continue
                    }

                    await client.models.Resident.create({
                        externalId: resident.person_id,
                        addressId: newAddressId,
                        firstName: resident['Occupant First Name'] || null,
                        lastName: resident['Occupant Last Name'] || null,
                        occupantType: resident['Occupant Type'] || null,
                        contactEmail: resident['Contact Email'] || null,
                        additionalEmail: resident['Additional Email'] || null,
                        cellPhone: resident['Cell Phone'] || null,
                        cellPhoneAlert: resident['Cell Phone Resident Alert Emergency'] || null,
                        unitPhone: resident['Unit Phone'] || null,
                        workPhone: resident['Work Phone'] || null,
                        isAbsentee: resident['Is Absentee'] === 'true',
                        hasSigned: false
                    })

                    residentCount++
                    if (residentCount % 50 === 0) {
                        setProgress({ current: residentCount, total: residents.length })
                        setStatus(`Importing residents... ${residentCount}/${residents.length}`)
                    }
                } catch (error: any) {
                    console.error(`Failed to import resident ${resident['Occupant First Name']} ${resident['Occupant Last Name']}:`, error)
                }
            }

            setStatus(`✅ Import complete! ${addressCount} addresses and ${residentCount} residents imported.`)
            setProgress({ current: 0, total: 0 })
            setAddressFile(null)
            setResidentsFile(null)
            await getStats()
        } catch (error) {
            console.error('Error importing data:', error)
            setStatus(`❌ Error: ${error}`)
        }
    }

    return (
        <div>
            <Header />
            <div style={{ maxWidth: 800, margin: '20px auto', padding: 16 }}>
                <h2>Data Management (Admin Only)</h2>
                <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
                    ⚠️ WARNING: These operations affect production data!
                </p>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Current Statistics</h3>
                    <button
                        onClick={getStats}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginBottom: 16
                        }}
                    >
                        Refresh Stats
                    </button>
                    <div style={{ fontSize: '1.1em' }}>
                        <div>📍 Addresses: <strong>{stats.addresses}</strong></div>
                        <div>👥 Residents: <strong>{stats.residents}</strong></div>
                        <div>✍️ Consents: <strong>{stats.consents}</strong></div>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#fff3cd',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Delete All Data</h3>
                    <p>This will delete ALL residents, addresses, consents, and assignments from production.</p>
                    <button
                        onClick={deleteAllData}
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '1.1em',
                            fontWeight: 'bold'
                        }}
                    >
                        🗑️ Delete All Data
                    </button>
                </div>

                <div style={{
                    backgroundColor: '#d1ecf1',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Import from CSV Files</h3>
                    <p>Upload address2.csv and residents2.csv to populate the database.</p>

                    <div style={{ marginTop: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                                Address CSV (address2.csv):
                            </label>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setAddressFile(e.target.files?.[0] || null)}
                                style={{ display: 'block' }}
                            />
                            {addressFile && <div style={{ color: '#28a745', marginTop: 4 }}>✓ {addressFile.name}</div>}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
                                Residents CSV (residents2.csv):
                            </label>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setResidentsFile(e.target.files?.[0] || null)}
                                style={{ display: 'block' }}
                            />
                            {residentsFile && <div style={{ color: '#28a745', marginTop: 4 }}>✓ {residentsFile.name}</div>}
                        </div>

                        <button
                            onClick={importData}
                            disabled={!addressFile || !residentsFile || progress.total > 0}
                            style={{
                                backgroundColor: (addressFile && residentsFile && progress.total === 0) ? '#28a745' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: 4,
                                cursor: (addressFile && residentsFile && progress.total === 0) ? 'pointer' : 'not-allowed',
                                fontSize: '1.1em',
                                fontWeight: 'bold'
                            }}
                        >
                            📤 Import CSV Files
                        </button>
                    </div>
                </div>

                {status && (
                    <div style={{
                        backgroundColor: '#e9ecef',
                        padding: 16,
                        borderRadius: 8,
                        marginTop: 16
                    }}>
                        <strong>Status:</strong> {status}
                        {progress.total > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{
                                    width: '100%',
                                    height: 24,
                                    backgroundColor: '#ddd',
                                    borderRadius: 4,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${(progress.current / progress.total) * 100}%`,
                                        height: '100%',
                                        backgroundColor: '#28a745',
                                        transition: 'width 0.3s ease'
                                    }}/>
                                </div>
                                <div style={{ marginTop: 4, fontSize: '0.9em' }}>
                                    Progress: {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
