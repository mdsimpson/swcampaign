import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function RecordConsents() {
    const [searchTerm, setSearchTerm] = useState('')
    const [addresses, setAddresses] = useState<any[]>([])
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })
    const [filteredAddresses, setFilteredAddresses] = useState<any[]>([])
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState('')

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

    async function recordConsent(residentId: string, addressId: string) {
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
            alert('Consent recorded successfully!')
        } catch (error) {
            console.error('Failed to record consent:', error)
            alert('Failed to record consent')
        }
    }

    async function handleFileUpload() {
        if (!selectedFile) return
        
        setUploadStatus('Processing...')
        const text = await selectedFile.text()
        const lines = text.split('\n').filter(line => line.trim())
        
        let processed = 0
        let newRecords = 0
        
        for (const line of lines.slice(1)) { // Skip header
            const [firstName, lastName, address] = line.split(',').map(s => s.trim())
            if (!firstName || !lastName || !address) continue
            
            // Find matching resident
            const matchingAddress = addresses.find(a => a.street.toLowerCase().includes(address.toLowerCase()))
            if (matchingAddress) {
                const matchingResident = matchingAddress.residents?.find((r: any) => 
                    r.firstName?.toLowerCase() === firstName.toLowerCase() && 
                    r.lastName?.toLowerCase() === lastName.toLowerCase()
                )
                
                if (matchingResident && !matchingResident.hasSigned) {
                    await recordConsent(matchingResident.id, matchingAddress.id)
                    newRecords++
                }
            }
            processed++
        }
        
        setUploadStatus(`Processed ${processed} entries, ${newRecords} new consents recorded.`)
        setSelectedFile(null)
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
                    <p>CSV format: FirstName, LastName, Address</p>
                    <input 
                        type='file'
                        accept='.csv'
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        style={{marginBottom: 12}}
                    />
                    <button 
                        onClick={handleFileUpload}
                        disabled={!selectedFile}
                        style={{
                            backgroundColor: selectedFile ? '#28a745' : '#ccc',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            marginLeft: 12
                        }}
                    >
                        Upload CSV
                    </button>
                    {uploadStatus && <p style={{marginTop: 8, color: '#666'}}>{uploadStatus}</p>}
                </div>
            </div>
        </div>
    )
}
