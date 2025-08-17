import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import billingAddresses from '../data/billingAddresses.json'

export default function AbsenteeInteractions() {
    const [absenteeAddresses, setAbsenteeAddresses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedAddress, setSelectedAddress] = useState<any>(null)
    const [contactMethod, setContactMethod] = useState('')
    const [notes, setNotes] = useState('')
    
    // Filter state
    const [searchTerm, setSearchTerm] = useState('')
    const [cityFilter, setCityFilter] = useState('')
    const [availableCities, setAvailableCities] = useState<string[]>([])
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [nextToken, setNextToken] = useState<string | null>(null)
    const [previousTokens, setPreviousTokens] = useState<string[]>([])
    const pageSize = 50
    
    // Sorting state
    const [sortField, setSortField] = useState('street')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })
    
    // Helper function to get billing address for a resident
    function getBillingAddress(resident: any) {
        if (!resident.firstName || !resident.lastName) return null
        const key = `${resident.firstName} ${resident.lastName}`.toLowerCase()
        return billingAddresses[key as keyof typeof billingAddresses] || null
    }

    useEffect(() => {
        loadAbsenteeAddresses()
        loadCities()
    }, [currentPage, sortField, sortDirection])

    async function loadCities() {
        try {
            // Load ALL addresses with pagination
            let allAddresses = []
            let addressesNextToken = null
            
            do {
                const addressesResult = await client.models.Address.list({ 
                    limit: 1000,
                    nextToken: addressesNextToken
                })
                allAddresses.push(...addressesResult.data)
                addressesNextToken = addressesResult.nextToken
            } while (addressesNextToken)
            
            // Load ALL absentee residents with pagination
            let allAbsenteeResidents = []
            let residentsNextToken = null
            
            do {
                const residentsResult = await client.models.Resident.list({ 
                    filter: { isAbsentee: { eq: true } },
                    limit: 1000,
                    nextToken: residentsNextToken
                })
                allAbsenteeResidents.push(...residentsResult.data)
                residentsNextToken = residentsResult.nextToken
            } while (residentsNextToken)
            
            const addressesResult = { data: allAddresses }
            const residentsResult = { data: allAbsenteeResidents }
            
            const absenteeAddressIds = new Set(residentsResult.data.map(r => r.addressId))
            const absenteeCities = addressesResult.data
                .filter(addr => absenteeAddressIds.has(addr.id))
                .map(addr => addr.city)
                .filter(Boolean)
            
            setAvailableCities([...new Set(absenteeCities)].sort())
        } catch (error) {
            console.error('Failed to load cities:', error)
        }
    }

    async function loadAbsenteeAddresses() {
        try {
            setLoading(true)
            
            console.log('Loading absentee addresses with residents...')
            
            // Get all addresses and absentee residents with pagination
            let allAddresses = []
            let addressesNextToken = null
            
            do {
                const addressesResult = await client.models.Address.list({ 
                    limit: 1000,
                    nextToken: addressesNextToken
                })
                allAddresses.push(...addressesResult.data)
                addressesNextToken = addressesResult.nextToken
            } while (addressesNextToken)
            
            let allAbsenteeResidents = []
            let residentsNextToken = null
            
            do {
                const absenteeResidentsResult = await client.models.Resident.list({ 
                    filter: { isAbsentee: { eq: true } },
                    limit: 1000,
                    nextToken: residentsNextToken
                })
                allAbsenteeResidents.push(...absenteeResidentsResult.data)
                residentsNextToken = absenteeResidentsResult.nextToken
            } while (residentsNextToken)
            
            const addressesResult = { data: allAddresses }
            const absenteeResidentsResult = { data: allAbsenteeResidents }
            
            console.log(`Found ${addressesResult.data.length} addresses and ${absenteeResidentsResult.data.length} absentee residents`)
            
            // Group absentee residents by address
            const absenteeResidentsByAddress = new Map()
            absenteeResidentsResult.data.forEach(resident => {
                if (!absenteeResidentsByAddress.has(resident.addressId)) {
                    absenteeResidentsByAddress.set(resident.addressId, [])
                }
                absenteeResidentsByAddress.get(resident.addressId).push(resident)
            })
            
            // Find addresses that have absentee residents and match filters
            const absenteeAddressList = addressesResult.data
                .filter(address => {
                    const hasAbsenteeResidents = absenteeResidentsByAddress.has(address.id)
                    if (!hasAbsenteeResidents) return false
                    
                    // Apply search filter
                    const matchesSearch = !searchTerm.trim() || 
                        address.street?.toLowerCase().includes(searchTerm.toLowerCase())
                    
                    // Apply city filter
                    const matchesCity = !cityFilter || address.city === cityFilter
                    
                    return matchesSearch && matchesCity
                })
                .map(address => ({
                    ...address,
                    residents: absenteeResidentsByAddress.get(address.id) || []
                }))
            
            // Apply sorting
            absenteeAddressList.sort((a, b) => {
                let aVal: any, bVal: any
                
                switch (sortField) {
                    case 'street':
                        aVal = a.street || ''
                        bVal = b.street || ''
                        break
                    case 'city':
                        aVal = a.city || ''
                        bVal = b.city || ''
                        break
                    default:
                        aVal = a.street || ''
                        bVal = b.street || ''
                }
                
                if (typeof aVal === 'string') {
                    const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
                    return sortDirection === 'asc' ? comparison : -comparison
                }
                
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
            
            console.log(`Found ${absenteeAddressList.length} addresses with absentee residents`)
            
            setAbsenteeAddresses(absenteeAddressList)
            setTotalCount(absenteeAddressList.length)
            
        } catch (error) {
            console.error('Failed to load absentee addresses:', error)
        } finally {
            setLoading(false)
        }
    }
    
    function applyFilters() {
        setCurrentPage(1) // Reset to first page when filters change
        loadAbsenteeAddresses()
    }
    
    function handleSort(field: string) {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    async function recordContact(addressId: string) {
        if (!contactMethod || !notes.trim()) {
            alert('Please select a contact method and enter notes')
            return
        }

        try {
            await client.models.InteractionRecord.create({
                addressId,
                spokeToHomeowner: contactMethod === 'phone' || contactMethod === 'email',
                spokeToOther: false,
                leftFlyer: contactMethod === 'mail',
                notes: `Contact via ${contactMethod}: ${notes}`,
                createdAt: new Date().toISOString()
            })
            
            alert('Contact recorded successfully')
            setSelectedAddress(null)
            setContactMethod('')
            setNotes('')
        } catch (error) {
            console.error('Failed to record contact:', error)
            alert('Failed to record contact')
        }
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1000, margin: '20px auto'}}>
                    <h2>Absentee Owners</h2>
                    <p>Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '20px auto', padding: 12}}>
                <h2>Absentee Owners</h2>
                <p>Properties where the mailing address differs from the property address.</p>
                
                {/* Filters */}
                <div style={{
                    display: 'flex', 
                    gap: 16, 
                    marginBottom: 16, 
                    flexWrap: 'wrap',
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'end'
                }}>
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Search:</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Property address..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        />
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>City:</label>
                        <select
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="">All Cities</option>
                            {availableCities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                    
                    <button
                        onClick={applyFilters}
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Apply Filters
                    </button>
                </div>

                {/* Stats */}
                <div style={{marginBottom: 16, fontSize: '0.9em', color: '#666'}}>
                    Showing {absenteeAddresses.length} absentee addresses (Page {currentPage} of {Math.ceil(totalCount / pageSize)})
                </div>
                
                {absenteeAddresses.length === 0 && !loading ? (
                    <p>No absentee owners found.</p>
                ) : (
                    <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 16}}>
                            <thead>
                                <tr style={{backgroundColor: '#f8f9fa'}}>
                                    <th 
                                        style={{
                                            border: '1px solid #ddd', 
                                            padding: 8, 
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            backgroundColor: sortField === 'street' ? '#e9ecef' : 'transparent'
                                        }}
                                        onClick={() => handleSort('street')}
                                    >
                                        Property Address {sortField === 'street' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th 
                                        style={{
                                            border: '1px solid #ddd', 
                                            padding: 8, 
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            backgroundColor: sortField === 'mailingCity' ? '#e9ecef' : 'transparent'
                                        }}
                                        onClick={() => handleSort('mailingCity')}
                                    >
                                        Billing Address {sortField === 'mailingCity' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Owners</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Contact Info</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {absenteeAddresses.map(address => (
                                    <tr key={address.id}>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {address.street}<br/>
                                            {address.city}, {address.state} {address.zip}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {(() => {
                                                // Get billing addresses for all residents at this property
                                                const billingAddressList = address.residents?.map((resident: any) => {
                                                    const billing = getBillingAddress(resident)
                                                    if (billing) {
                                                        return {
                                                            name: `${resident.firstName} ${resident.lastName}`,
                                                            address: `${billing.street}, ${billing.city}, ${billing.state} ${billing.zip}`
                                                        }
                                                    }
                                                    return null
                                                }).filter(Boolean) || []
                                                
                                                if (billingAddressList.length > 0) {
                                                    // Remove duplicates (same billing address)
                                                    const uniqueAddresses = Array.from(new Set(billingAddressList.map((b: any) => b.address)))
                                                    
                                                    return uniqueAddresses.map((addr, i) => {
                                                        // Create Google Maps URL for the address
                                                        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                                                        
                                                        return (
                                                            <div key={i}>
                                                                <a 
                                                                    href={mapsUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{
                                                                        color: '#007bff',
                                                                        textDecoration: 'none',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                                                    title="View on Google Maps"
                                                                >
                                                                    📍 {addr}
                                                                </a>
                                                                {i < uniqueAddresses.length - 1 && <br/>}
                                                            </div>
                                                        )
                                                    })
                                                } else {
                                                    return <span style={{color: '#999', fontStyle: 'italic'}}>No billing address available</span>
                                                }
                                            })()}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {address.residents?.map((resident: any, i: number) => (
                                                <div key={resident.id}>
                                                    {resident.firstName} {resident.lastName}
                                                    {resident.occupantType && ` (${resident.occupantType})`}
                                                    {i < address.residents.length - 1 && <br/>}
                                                </div>
                                            )) || 'No residents listed'}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {address.residents?.map((resident: any, i: number) => (
                                                <div key={resident.id} style={{fontSize: '0.9em'}}>
                                                    {resident.contactEmail && <div>📧 <a href={`mailto:${resident.contactEmail}`} style={{color: '#007bff', textDecoration: 'none'}}>{resident.contactEmail}</a></div>}
                                                    {resident.additionalEmail && <div>📧 <a href={`mailto:${resident.additionalEmail}`} style={{color: '#007bff', textDecoration: 'none'}}>{resident.additionalEmail}</a></div>}
                                                    {resident.cellPhone && <div>📱 {resident.cellPhone}</div>}
                                                    {resident.unitPhone && <div>📞 {resident.unitPhone}</div>}
                                                    {resident.workPhone && <div>🏢 {resident.workPhone}</div>}
                                                    {i < address.residents.length - 1 && <br/>}
                                                </div>
                                            ))}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            <button 
                                                onClick={() => setSelectedAddress(address)}
                                                style={{
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: 4,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Record Contact
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalCount > pageSize && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 16,
                        padding: 16
                    }}>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                                backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Previous
                        </button>
                        
                        <span style={{margin: '0 16px'}}>
                            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                        </span>
                        
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                            style={{
                                backgroundColor: currentPage >= Math.ceil(totalCount / pageSize) ? '#6c757d' : '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                cursor: currentPage >= Math.ceil(totalCount / pageSize) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}

                {selectedAddress && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            padding: 24,
                            borderRadius: 8,
                            maxWidth: 500,
                            width: '90%'
                        }}>
                            <h3>Record Contact: {selectedAddress.street}</h3>
                            
                            <div style={{marginBottom: 16}}>
                                <label style={{display: 'block', marginBottom: 8}}>Contact Method:</label>
                                <select 
                                    value={contactMethod}
                                    onChange={(e) => setContactMethod(e.target.value)}
                                    style={{width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                                >
                                    <option value="">Select method...</option>
                                    <option value="phone">Phone Call</option>
                                    <option value="email">Email</option>
                                    <option value="text">Text Message</option>
                                    <option value="mail">Postal Mail</option>
                                </select>
                            </div>

                            <div style={{marginBottom: 16}}>
                                <label style={{display: 'block', marginBottom: 8}}>Notes:</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Record details of contact attempt, response, etc..."
                                    style={{
                                        width: '100%',
                                        height: 100,
                                        padding: 8,
                                        borderRadius: 4,
                                        border: '1px solid #ddd',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                                <button
                                    onClick={() => {
                                        setSelectedAddress(null)
                                        setContactMethod('')
                                        setNotes('')
                                    }}
                                    style={{
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => recordContact(selectedAddress.id)}
                                    style={{
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Record Contact
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
