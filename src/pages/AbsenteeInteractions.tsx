import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'

export default function AbsenteeInteractions() {
    const [absenteeHomes, setAbsenteeHomes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedHome, setSelectedHome] = useState<any>(null)
    const [contactMethod, setContactMethod] = useState('')
    const [notes, setNotes] = useState('')
    
    // Filter state
    const [searchTerm, setSearchTerm] = useState('')
    const [cityFilter, setCityFilter] = useState('')
    const [availableCities, setAvailableCities] = useState<string[]>([])
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const pageSize = 20
    
    // Sorting state
    const [sortField, setSortField] = useState('street')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    useEffect(() => {
        loadAbsenteeHomes()
        loadCities()
    }, [currentPage, sortField, sortDirection])

    async function loadCities() {
        try {
            const result = await client.models.Home.list({
                filter: { absenteeOwner: { eq: true } }
            })
            const cities = [...new Set(result.data.map(home => home.city).filter(Boolean))]
            setAvailableCities(cities.sort())
        } catch (error) {
            console.error('Failed to load cities:', error)
        }
    }

    async function loadAbsenteeHomes() {
        try {
            setLoading(true)
            
            // Build filter for absentee homes
            let homeFilter: any = { absenteeOwner: { eq: true } }
            
            // Add search filter if applied
            if (searchTerm.trim()) {
                homeFilter = {
                    and: [
                        homeFilter,
                        {
                            or: [
                                { street: { contains: searchTerm.trim() } },
                                { mailingStreet: { contains: searchTerm.trim() } }
                            ]
                        }
                    ]
                }
            }
            
            // Add city filter if applied
            if (cityFilter) {
                homeFilter = {
                    and: [
                        homeFilter,
                        { city: { eq: cityFilter } }
                    ]
                }
            }
            
            const result = await client.models.Home.list({
                filter: homeFilter,
                limit: pageSize
            })
            
            // Load residents for each home
            const homesWithResidents = await Promise.all(
                result.data.map(async (home) => {
                    const residentsResult = await client.models.Person.list({
                        filter: { homeId: { eq: home.id } }
                    })
                    return { ...home, residents: residentsResult.data }
                })
            )
            
            // Apply sorting
            homesWithResidents.sort((a, b) => {
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
                    case 'mailingCity':
                        aVal = a.mailingCity || ''
                        bVal = b.mailingCity || ''
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
            
            setAbsenteeHomes(homesWithResidents)
            setTotalCount(homesWithResidents.length) // Approximate count
            
        } catch (error) {
            console.error('Failed to load absentee homes:', error)
        } finally {
            setLoading(false)
        }
    }
    
    function applyFilters() {
        setCurrentPage(1) // Reset to first page when filters change
        loadAbsenteeHomes()
    }
    
    function handleSort(field: string) {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    async function recordContact(homeId: string) {
        if (!contactMethod || !notes.trim()) {
            alert('Please select a contact method and enter notes')
            return
        }

        try {
            await client.models.InteractionRecord.create({
                homeId,
                spokeToHomeowner: contactMethod === 'phone' || contactMethod === 'email',
                spokeToOther: false,
                leftFlyer: contactMethod === 'mail',
                notes: `Contact via ${contactMethod}: ${notes}`,
                createdAt: new Date().toISOString()
            })
            
            alert('Contact recorded successfully')
            setSelectedHome(null)
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
                            placeholder="Property or mailing address..."
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
                    Showing {absenteeHomes.length} absentee homes (Page {currentPage} of {Math.ceil(totalCount / pageSize)})
                </div>
                
                {absenteeHomes.length === 0 && !loading ? (
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
                                        Mailing Address {sortField === 'mailingCity' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Owners</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Contact Info</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {absenteeHomes.map(home => (
                                    <tr key={home.id}>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {/* Handle case where unitNumber and street might contain duplicate data */}
                                            {home.unitNumber && home.street && home.unitNumber !== home.street 
                                                ? `${home.unitNumber} ${home.street}` 
                                                : (home.street || home.unitNumber)
                                            }<br/>
                                            {home.city}, {home.state} {home.postalCode}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.mailingStreet}<br/>
                                            {home.mailingCity}, {home.mailingState} {home.mailingPostalCode}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.residents?.map((person: any, i: number) => (
                                                <div key={person.id}>
                                                    {person.firstName} {person.lastName}
                                                    {person.role && ` (${person.role.replace('_', ' ')})`}
                                                    {i < home.residents.length - 1 && <br/>}
                                                </div>
                                            )) || 'No residents listed'}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.residents?.map((person: any, i: number) => (
                                                <div key={person.id} style={{fontSize: '0.9em'}}>
                                                    {person.email && <div>📧 {person.email}</div>}
                                                    {person.mobilePhone && <div>📱 {person.mobilePhone}</div>}
                                                    {i < home.residents.length - 1 && <br/>}
                                                </div>
                                            ))}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            <button 
                                                onClick={() => setSelectedHome(home)}
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

                {selectedHome && (
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
                            <h3>Record Contact: {selectedHome.street}</h3>
                            
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
                                        setSelectedHome(null)
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
                                    onClick={() => recordContact(selectedHome.id)}
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
