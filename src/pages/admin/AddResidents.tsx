import Header from '../../components/Header'
import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../amplify/data/resource'
import Papa from 'papaparse'

export default function AddResidents() {
    const [status, setStatus] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [results, setResults] = useState<any>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const client = generateClient<Schema>()

    async function handleAddResidents() {
        if (!selectedFile) {
            alert('Please select a CSV file first')
            return
        }

        if (!confirm('This will add new residents from the CSV file. Continue?')) {
            return
        }

        try {
            setStatus('Reading CSV file...')
            const text = await selectedFile.text()

            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            })

            const rows = parsed.data as any[]
            setProgress({ current: 0, total: rows.length })
            setStatus(`Found ${rows.length} residents in CSV`)

            // Load all addresses
            setStatus('Loading all addresses from database...')
            let allAddresses: any[] = []
            let nextToken = null
            do {
                const result = await client.models.Address.list({
                    limit: 1000,
                    nextToken: nextToken
                })
                allAddresses.push(...result.data)
                nextToken = result.nextToken
            } while (nextToken)

            setStatus(`Loaded ${allAddresses.length} addresses. Processing residents...`)

            // Create a map of normalized street -> address for faster lookup
            const addressByStreet = new Map<string, any>()
            allAddresses.forEach(addr => {
                if (addr.street) {
                    const normalizedStreet = addr.street.toLowerCase().trim()
                    addressByStreet.set(normalizedStreet, addr)
                }
            })

            let processed = 0
            let added = 0
            let addressNotFound = 0
            let skipped = 0
            const addedList: any[] = []
            const notFoundList: any[] = []
            const skippedList: any[] = []

            for (const row of rows) {
                const personId = row.person_id?.trim()
                const street = row.Street?.trim()
                const lastName = row['Occupant Last Name']?.trim()
                const firstName = row['Occupant First Name']?.trim() || ''

                // Only personId, street, and lastName are required (firstName can be blank for LLCs)
                if (!personId || !street || !lastName) {
                    skipped++
                    skippedList.push({
                        personId: personId || 'N/A',
                        name: `${firstName} ${lastName}`.trim() || 'N/A',
                        street: street || 'N/A',
                        reason: 'Missing required fields (person_id, Street, or Last Name)'
                    })
                    processed++
                    continue
                }

                try {
                    // Find address by street (case insensitive)
                    const normalizedStreet = street.toLowerCase().trim()
                    const address = addressByStreet.get(normalizedStreet)

                    if (address) {
                        // Create new resident
                        await client.models.Resident.create({
                            personId: personId,
                            externalId: personId,
                            addressId: address.id,
                            firstName: firstName,
                            lastName: lastName,
                            hasSigned: false
                        })

                        added++
                        addedList.push({
                            personId,
                            name: `${firstName} ${lastName}`,
                            street: address.street
                        })
                        console.log(`✅ Added: ${firstName} ${lastName} (ID: ${personId}) to ${address.street}`)
                    } else {
                        addressNotFound++
                        notFoundList.push({
                            personId,
                            name: `${firstName} ${lastName}`,
                            street: street
                        })
                        console.log(`⚠️  Address not found: ${street} for ${firstName} ${lastName}`)
                    }
                } catch (err) {
                    skipped++
                    skippedList.push({
                        personId,
                        name: `${firstName} ${lastName}`,
                        street: street,
                        reason: String(err)
                    })
                    console.error(`❌ Error adding ${firstName} ${lastName}:`, err)
                }

                processed++
                setProgress({ current: processed, total: rows.length })
                setStatus(`Processing... ${processed}/${rows.length}`)
            }

            setResults({
                total: rows.length,
                added,
                addressNotFound,
                skipped,
                addedList,
                notFoundList,
                skippedList
            })

            setStatus(`✅ Complete! Added ${added}, Address not found ${addressNotFound}, Skipped ${skipped}`)
            setProgress({ current: 0, total: 0 })

        } catch (error) {
            console.error('Error:', error)
            setStatus(`❌ Error: ${error}`)
            setProgress({ current: 0, total: 0 })
        }
    }

    return (
        <div>
            <Header />
            <div style={{ maxWidth: 1200, margin: '20px auto', padding: 16 }}>
                <h2>Add New Residents</h2>
                <p style={{ color: '#666', marginBottom: 24 }}>
                    Upload a CSV file with new residents to add to the database. The file should have columns:
                    person_id, Street, Occupant Last Name, Occupant First Name
                </p>

                <div style={{
                    backgroundColor: '#d1ecf1',
                    border: '1px solid #bee5eb',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24
                }}>
                    <h3 style={{ color: '#0c5460', marginTop: 0 }}>ℹ️ How it works</h3>
                    <ul style={{ color: '#0c5460', marginBottom: 0 }}>
                        <li>The Street column is matched to existing addresses (case insensitive)</li>
                        <li>New residents will be linked to the matching address</li>
                        <li>All residents at an address will be visible on organize and canvassing pages</li>
                        <li>All residents at an address must sign before the household is counted</li>
                    </ul>
                </div>

                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 24
                }}>
                    <h3>Upload Residents CSV</h3>
                    <p style={{ fontSize: '14px', color: '#666' }}>
                        CSV should have columns: person_id, Street, Occupant Last Name, Occupant First Name
                    </p>

                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        style={{ marginBottom: 16, display: 'block' }}
                    />

                    {selectedFile && (
                        <div style={{ color: '#28a745', marginBottom: 16 }}>
                            ✓ Selected: {selectedFile.name}
                        </div>
                    )}

                    <button
                        onClick={handleAddResidents}
                        disabled={!selectedFile || progress.total > 0}
                        style={{
                            backgroundColor: selectedFile && progress.total === 0 ? '#007bff' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: 4,
                            cursor: selectedFile && progress.total === 0 ? 'pointer' : 'not-allowed',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        Add Residents
                    </button>
                </div>

                {progress.total > 0 && (
                    <div style={{
                        backgroundColor: '#e9ecef',
                        padding: 16,
                        borderRadius: 8,
                        marginBottom: 16
                    }}>
                        <div style={{
                            width: '100%',
                            height: 24,
                            backgroundColor: '#ddd',
                            borderRadius: 4,
                            overflow: 'hidden',
                            marginBottom: 8
                        }}>
                            <div style={{
                                width: `${(progress.current / progress.total) * 100}%`,
                                height: '100%',
                                backgroundColor: '#007bff',
                                transition: 'width 0.3s ease'
                            }}/>
                        </div>
                        <div style={{ fontSize: '14px' }}>
                            Progress: {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                        </div>
                    </div>
                )}

                {status && (
                    <div style={{
                        backgroundColor: '#e9ecef',
                        padding: 12,
                        borderRadius: 4,
                        marginBottom: 16,
                        fontSize: '14px'
                    }}>
                        {status}
                    </div>
                )}

                {results && (
                    <div>
                        <div style={{
                            backgroundColor: '#d4edda',
                            border: '1px solid #28a745',
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 24
                        }}>
                            <h3 style={{ color: '#155724', marginTop: 0 }}>Summary</h3>
                            <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
                                <div><strong>Total in CSV:</strong> {results.total}</div>
                                <div style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Added: {results.added}</div>
                                <div style={{ color: '#ffc107', fontWeight: 'bold' }}>⚠️ Address not found: {results.addressNotFound}</div>
                                <div style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Skipped: {results.skipped}</div>
                            </div>
                        </div>

                        {results.addedList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#28a745' }}>✅ Added ({results.addedList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.addedList.map((person: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {person.name} (ID: {person.personId}) → {person.street}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.notFoundList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#ffc107' }}>⚠️ Address Not Found ({results.notFoundList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.notFoundList.map((person: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {person.name} (ID: {person.personId}) - Street: {person.street}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.skippedList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ color: '#dc3545' }}>❌ Skipped ({results.skippedList.length})</h3>
                                <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {results.skippedList.map((person: any, index: number) => (
                                        <div key={index} style={{ padding: '4px 0' }}>
                                            • {person.name} (ID: {person.personId}) - {person.reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
