import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

const client = generateClient<Schema>()

export default function RecordConsents() {
    const [searchTerm, setSearchTerm] = useState('')
    const [homes, setHomes] = useState<any[]>([])
    const [filteredHomes, setFilteredHomes] = useState<any[]>([])
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState('')

    useEffect(() => {
        loadHomes()
    }, [])

    useEffect(() => {
        if (searchTerm) {
            const filtered = homes.filter(home => 
                home.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
                home.residents?.some((person: any) => 
                    `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
            setFilteredHomes(filtered)
        } else {
            setFilteredHomes([])
        }
    }, [searchTerm, homes])

    async function loadHomes() {
        try {
            const result = await client.models.Home.list()
            const homesWithResidents = await Promise.all(
                result.data.map(async (home) => {
                    const residents = await client.models.Person.list({
                        filter: { homeId: { eq: home.id } }
                    })
                    return { ...home, residents: residents.data }
                })
            )
            setHomes(homesWithResidents)
        } catch (error) {
            console.error('Failed to load homes:', error)
        }
    }

    async function recordConsent(personId: string, homeId: string) {
        try {
            await client.models.Consent.create({
                personId,
                homeId,
                recordedAt: new Date().toISOString(),
                source: 'manual'
            })
            
            await client.models.Person.update({
                id: personId,
                hasSigned: true,
                signedAt: new Date().toISOString()
            })
            
            await loadHomes() // Refresh data
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
            
            // Find matching person
            const matchingHome = homes.find(h => h.street.toLowerCase().includes(address.toLowerCase()))
            if (matchingHome) {
                const matchingPerson = matchingHome.residents?.find((p: any) => 
                    p.firstName?.toLowerCase() === firstName.toLowerCase() && 
                    p.lastName?.toLowerCase() === lastName.toLowerCase()
                )
                
                if (matchingPerson && !matchingPerson.hasSigned) {
                    await recordConsent(matchingPerson.id, matchingHome.id)
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
                    
                    {filteredHomes.length > 0 && (
                        <div style={{border: '1px solid #ddd', borderRadius: 4, maxHeight: 400, overflowY: 'auto'}}>
                            {filteredHomes.map(home => (
                                <div key={home.id} style={{padding: 12, borderBottom: '1px solid #eee'}}>
                                    <strong>{home.street}</strong>
                                    <div style={{marginTop: 8}}>
                                        {home.residents?.map((person: any) => (
                                            <div key={person.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0'}}>
                                                <span>
                                                    {person.firstName} {person.lastName} 
                                                    {person.hasSigned && <span style={{color: 'green', marginLeft: 8}}>✓ Signed</span>}
                                                </span>
                                                {!person.hasSigned && (
                                                    <button 
                                                        onClick={() => recordConsent(person.id, home.id)}
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
