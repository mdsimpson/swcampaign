import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import Papa from 'papaparse'

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

        let processed = 0
        let newRecords = 0
        let alreadySigned = 0
        let notFound = 0
        const errors: string[] = []

        for (const row of rows) {
            const firstName = row.resident_first_name?.trim()
            const lastName = row.resident_last_name?.trim()
            const street = row.resident_street?.trim() || row.expanded_street?.trim()

            if (!firstName || !lastName || !street) {
                processed++
                continue
            }

            try {
                // Find resident by first name, last name
                const residents = await client.models.Resident.list({
                    filter: {
                        and: [
                            { firstName: { eq: firstName } },
                            { lastName: { eq: lastName } }
                        ]
                    }
                })

                // Filter by address street (client-side since we can't join in the filter)
                let foundResident = null
                for (const resident of residents.data) {
                    const address = await client.models.Address.get({ id: resident.addressId! })
                    if (address.data?.street.toLowerCase() === street.toLowerCase()) {
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
            </div>
        </div>
    )
}
