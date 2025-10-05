import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import Papa from 'papaparse'

function normalizeStreet(street: string): string {
    return street.toLowerCase()
        .replace(/\bterrace\b/g, 'ter')
        .replace(/\bcircle\b/g, 'cir')
        .replace(/\bcourt\b/g, 'ct')
        .replace(/\bdrive\b/g, 'dr')
        .replace(/\bstreet\b/g, 'st')
        .replace(/\bavenue\b/g, 'ave')
        .replace(/\broad\b/g, 'rd')
        .replace(/\blane\b/g, 'ln')
        .replace(/\bsquare\b/g, 'sq')
        .replace(/\bplace\b/g, 'pl')
        .replace(/\bboulevard\b/g, 'blvd')
        .replace(/\s+/g, ' ')
        .trim()
}

export default function RecordConsents() {
    const [searchTerm, setSearchTerm] = useState('')
    const [addresses, setAddresses] = useState<any[]>([])
    
    const client = generateClient<Schema>()
    const [filteredAddresses, setFilteredAddresses] = useState<any[]>([])
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState('')
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

    useEffect(() => {
        loadAddresses()
    }, [])

    useEffect(() => {
        if (searchTerm) {
            const filtered = addresses.filter(address => 
                address.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
                address.residents?.some((resident: any) => 
                    `${resident.firstName} ${resident.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
            setFilteredAddresses(filtered)
        } else {
            setFilteredAddresses([])
        }
    }, [searchTerm, addresses])

    async function loadAddresses() {
        try {
            const result = await client.models.Address.list()
            const addressesWithResidents = await Promise.all(
                result.data.map(async (address) => {
                    const residents = await client.models.Resident.list({
                        filter: { addressId: { eq: address.id } }
                    })
                    return { ...address, residents: residents.data }
                })
            )
            setAddresses(addressesWithResidents)
        } catch (error) {
            console.error('Failed to load addresses:', error)
        }
    }

    async function recordConsent(residentId: string, addressId: string, showAlert = true) {
        try {
            await client.models.Consent.create({
                residentId,
                addressId,
                recordedAt: new Date().toISOString(),
                source: 'manual'
            })

            await client.models.Resident.update({
                id: residentId,
                hasSigned: true,
                signedAt: new Date().toISOString()
            })

            await loadAddresses() // Refresh data
            if (showAlert) alert('Consent recorded successfully!')
        } catch (error) {
            console.error('Failed to record consent:', error)
            if (showAlert) alert('Failed to record consent')
        }
    }

    async function deleteAllConsents() {
        if (!confirm('⚠️ WARNING: This will DELETE ALL consents and reset all residents to unsigned. Are you sure?')) {
            return
        }

        try {
            setUploadStatus('Deleting all consents...')
            setUploadProgress({ current: 0, total: 0 })

            // Delete all consents
            let consentsNextToken = null
            let deletedCount = 0
            do {
                const consents = await client.models.Consent.list({ limit: 100, nextToken: consentsNextToken })
                for (const consent of consents.data) {
                    await client.models.Consent.delete({ id: consent.id })
                    deletedCount++
                    if (deletedCount % 50 === 0) {
                        setUploadProgress({ current: deletedCount, total: deletedCount })
                    }
                }
                consentsNextToken = consents.nextToken
            } while (consentsNextToken)

            setUploadStatus('Resetting resident signatures...')

            // Reset all residents' hasSigned status
            let residentsNextToken = null
            let resetCount = 0
            do {
                const residents = await client.models.Resident.list({ limit: 100, nextToken: residentsNextToken })
                for (const resident of residents.data) {
                    if (resident.hasSigned) {
                        await client.models.Resident.update({
                            id: resident.id,
                            hasSigned: false,
                            signedAt: null
                        })
                        resetCount++
                        if (resetCount % 50 === 0) {
                            setUploadProgress({ current: resetCount, total: resetCount })
                        }
                    }
                }
                residentsNextToken = residents.nextToken
            } while (residentsNextToken)

            setUploadStatus(`✅ Deleted ${deletedCount} consents and reset ${resetCount} residents`)
            setUploadProgress({ current: 0, total: 0 })
            await loadAddresses()
        } catch (error) {
            console.error('Error deleting consents:', error)
            setUploadStatus(`❌ Error: ${error}`)
        }
    }

    async function handleFileUpload() {
        if (!selectedFile) return

        setUploadStatus('Processing...')
        const text = await selectedFile.text()

        // Parse CSV properly with papaparse
        const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true
        })

        const rows = parsed.data as any[]
        setUploadProgress({ current: 0, total: rows.length })

        // Load ALL residents (like /organize page does)
        setUploadStatus('Loading all residents from database...')
        let allResidents: any[] = []
        let residentsNextToken = null
        do {
            const residentsResult = await client.models.Resident.list({
                limit: 1000,
                nextToken: residentsNextToken
            })
            allResidents.push(...residentsResult.data)
            residentsNextToken = residentsResult.nextToken
        } while (residentsNextToken)

        console.log(`=== Loaded ${allResidents.length} total residents from database ===`)

        let processed = 0
        let newRecords = 0
        let alreadySigned = 0
        let notFound = 0
        const errors: string[] = []

        setUploadStatus('Processing consent records...')

        for (const row of rows) {
            const firstName = row.resident_first_name?.trim()
            const lastName = row.resident_last_name?.trim()
            const street = row.resident_street?.trim() || row.expanded_street?.trim()

            if (!firstName || !lastName || !street) {
                processed++
                continue
            }

            try {
                // Find resident by name (client-side filtering like /organize page)
                const nameMatches = allResidents.filter(r =>
                    r.firstName?.toLowerCase() === firstName?.toLowerCase() &&
                    r.lastName?.toLowerCase() === lastName?.toLowerCase()
                )

                if (processed < 5) {
                    console.log(`[${processed + 1}] Searching: ${firstName} ${lastName} at ${street}`)
                    console.log(`   Found ${nameMatches.length} name matches`)
                }

                // Find the one with matching address
                let foundResident = null
                const normalizedCsvStreet = normalizeStreet(street)

                for (const resident of nameMatches) {
                    const address = await client.models.Address.get({ id: resident.addressId! })
                    if (processed < 5 && address.data) {
                        console.log(`   Comparing: "${normalizedCsvStreet}" vs "${normalizeStreet(address.data.street)}"`)
                    }
                    if (address.data && normalizeStreet(address.data.street) === normalizedCsvStreet) {
                        foundResident = resident
                        break
                    }
                }

                if (foundResident) {
                    if (foundResident.hasSigned) {
                        alreadySigned++
                    } else {
                        await recordConsent(foundResident.id, foundResident.addressId!, false)
                        newRecords++
                    }
                } else {
                    notFound++
                    if (processed < 10) {
                        console.log(`   ❌ NOT FOUND: ${firstName} ${lastName} at ${street}`)
                    }
                    errors.push(`${firstName} ${lastName} at ${street}`)
                }
            } catch (err) {
                console.error(`Error processing ${firstName} ${lastName}:`, err)
                errors.push(`${firstName} ${lastName} - Error: ${err}`)
            }

            processed++
            setUploadProgress({ current: processed, total: rows.length })
        }

        await loadAddresses() // Refresh the data
        setUploadStatus(`Processed ${processed} entries, ${newRecords} new consents recorded, ${alreadySigned} already signed, ${notFound} not found.`)
        setUploadProgress({ current: 0, total: 0 })
        setSelectedFile(null)

        if (errors.length > 0 && errors.length <= 20) {
            console.log('Not found:', errors)
        } else if (errors.length > 20) {
            console.log('Not found (first 20):', errors.slice(0, 20))
            console.log(`... and ${errors.length - 20} more`)
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1000, margin: '20px auto', padding: 16}}>
                <h2>Record Consent Forms</h2>
                
                <div style={{marginBottom: 24}}>
                    <h3>Search and Record Individual Consents</h3>
                    <input 
                        type='text'
                        placeholder='Search by name or address...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{width: '100%', padding: 8, marginBottom: 16}}
                    />
                    
                    {filteredAddresses.length > 0 && (
                        <div style={{border: '1px solid #ddd', borderRadius: 4, maxHeight: 400, overflowY: 'auto'}}>
                            {filteredAddresses.map(address => (
                                <div key={address.id} style={{padding: 12, borderBottom: '1px solid #eee'}}>
                                    <strong>{address.street}</strong>
                                    <div style={{marginTop: 8}}>
                                        {address.residents?.map((resident: any) => (
                                            <div key={resident.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0'}}>
                                                <span>
                                                    {resident.firstName} {resident.lastName} 
                                                    {resident.hasSigned && <span style={{color: 'green', marginLeft: 8}}>✓ Signed</span>}
                                                </span>
                                                {!resident.hasSigned && (
                                                    <button 
                                                        onClick={() => recordConsent(resident.id, address.id)}
                                                        style={{backgroundColor: '#007bff', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4}}
                                                    >
                                                        Record Consent
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <h3>Bulk Upload Consents (CSV)</h3>
                    <p>CSV format: person_id, expanded_name, expanded_email, expanded_street, resident_street, resident_first_name, resident_last_name, resident_email, match_type</p>
                    <input 
                        type='file'
                        accept='.csv'
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        style={{marginBottom: 12}}
                    />
                    <button
                        onClick={handleFileUpload}
                        disabled={!selectedFile || uploadProgress.total > 0}
                        style={{
                            backgroundColor: selectedFile && uploadProgress.total === 0 ? '#28a745' : '#ccc',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            marginLeft: 12
                        }}
                    >
                        Upload CSV
                    </button>
                    {uploadProgress.total > 0 && (
                        <div style={{marginTop: 12}}>
                            <div style={{
                                width: '100%',
                                height: 24,
                                backgroundColor: '#e0e0e0',
                                borderRadius: 4,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#28a745',
                                    transition: 'width 0.3s ease'
                                }}/>
                            </div>
                            <p style={{marginTop: 4, color: '#666', fontSize: 14}}>
                                Processing {uploadProgress.current} of {uploadProgress.total}
                            </p>
                        </div>
                    )}
                    {uploadStatus && uploadProgress.total === 0 && <p style={{marginTop: 8, color: '#666'}}>{uploadStatus}</p>}
                </div>

                <div style={{marginTop: 32, paddingTop: 24, borderTop: '2px solid #ddd'}}>
                    <h3 style={{color: '#dc3545'}}>⚠️ Danger Zone</h3>
                    <p style={{color: '#666'}}>This will delete ALL consent records and reset all residents to unsigned status.</p>
                    <button
                        onClick={deleteAllConsents}
                        disabled={uploadProgress.total > 0}
                        style={{
                            backgroundColor: uploadProgress.total === 0 ? '#dc3545' : '#ccc',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: uploadProgress.total === 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                        }}
                    >
                        🗑️ Delete All Consents
                    </button>
                </div>
            </div>
        </div>
    )
}
