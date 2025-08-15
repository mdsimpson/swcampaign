import Header from '../components/Header'
import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Schema } from '../../amplify/data/resource'

export default function InteractionHistory() {
    const location = useLocation()
    const navigate = useNavigate()
    const [interactions, setInteractions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [homes, setHomes] = useState<any[]>([])
    const [people, setPeople] = useState<any[]>([])
    const [filteredAddress, setFilteredAddress] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalInteractions, setTotalInteractions] = useState(0)
    
    const ITEMS_PER_PAGE = 20
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    useEffect(() => {
        // Get address filter and page from URL params
        const params = new URLSearchParams(location.search)
        const addressParam = params.get('address') || ''
        const pageParam = parseInt(params.get('page') || '1')
        
        setFilteredAddress(addressParam)
        setCurrentPage(pageParam)
        
        loadData(addressParam)
    }, [location.search, currentPage])

    async function loadData(addressFilter = '') {
        try {
            setLoading(true)
            
            // Load all interactions
            let allInteractions: any[] = []
            let nextToken = null
            
            do {
                const result = await client.models.InteractionRecord.list({
                    limit: 1000,
                    nextToken
                })
                allInteractions.push(...result.data)
                nextToken = result.nextToken
            } while (nextToken)
            
            console.log(`Loaded ${allInteractions.length} total interactions`)
            
            // Load all homes for address filtering and display
            let allHomes: any[] = []
            let homesNextToken = null
            
            do {
                const result = await client.models.Home.list({
                    limit: 1000,
                    nextToken: homesNextToken
                })
                allHomes.push(...result.data)
                homesNextToken = result.nextToken
            } while (homesNextToken)
            
            setHomes(allHomes)
            console.log(`Loaded ${allHomes.length} total homes`)
            
            // Load all people for participant display
            let allPeople: any[] = []
            let peopleNextToken = null
            
            do {
                const result = await client.models.Person.list({
                    limit: 1000,
                    nextToken: peopleNextToken
                })
                allPeople.push(...result.data)
                peopleNextToken = result.nextToken
            } while (peopleNextToken)
            
            setPeople(allPeople)
            console.log(`Loaded ${allPeople.length} total people`)
            
            // Filter interactions by address if specified
            let filteredInteractions = allInteractions
            
            if (addressFilter.trim()) {
                console.log(`Filtering interactions for address: "${addressFilter}"`)
                
                // Find homes that match the address filter
                const matchingHomes = allHomes.filter(home => 
                    home.street?.toLowerCase().includes(addressFilter.toLowerCase())
                )
                const matchingHomeIds = new Set(matchingHomes.map(h => h.id))
                
                console.log(`Found ${matchingHomes.length} homes matching address filter`)
                
                // Filter interactions to only those at matching addresses
                filteredInteractions = allInteractions.filter(interaction => 
                    matchingHomeIds.has(interaction.homeId)
                )
                
                console.log(`Filtered to ${filteredInteractions.length} interactions at matching addresses`)
            }
            
            // Sort by creation date (newest first)
            filteredInteractions.sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            
            // Store total count for pagination
            setTotalInteractions(filteredInteractions.length)
            
            // Apply pagination to the sorted, filtered results
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
            const endIndex = startIndex + ITEMS_PER_PAGE
            const paginatedInteractions = filteredInteractions.slice(startIndex, endIndex)
            
            setInteractions(paginatedInteractions)
            
        } catch (error) {
            console.error('Failed to load interaction history:', error)
        } finally {
            setLoading(false)
        }
    }

    function clearAddressFilter() {
        navigate('/history', { replace: true })
    }

    function updateUrlParams(params: { address?: string; page?: number }) {
        const searchParams = new URLSearchParams(location.search)
        
        if (params.address !== undefined) {
            if (params.address) {
                searchParams.set('address', params.address)
            } else {
                searchParams.delete('address')
            }
        }
        
        if (params.page !== undefined) {
            if (params.page > 1) {
                searchParams.set('page', params.page.toString())
            } else {
                searchParams.delete('page')
            }
        }
        
        const newSearch = searchParams.toString()
        const newPath = newSearch ? `/history?${newSearch}` : '/history'
        navigate(newPath, { replace: true })
    }

    function goToPage(page: number) {
        updateUrlParams({ page })
    }

    const totalPages = Math.ceil(totalInteractions / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1
    const endIndex = Math.min(startIndex + interactions.length - 1, totalInteractions)

    function getHomeForInteraction(interaction: any) {
        return homes.find(h => h.id === interaction.homeId)
    }

    function getParticipantsDisplay(interaction: any) {
        if (!interaction.participantPersonIds) return 'No participants recorded'
        
        // Parse CSV of person IDs
        const personIds = interaction.participantPersonIds.split(',').map(id => id.trim()).filter(id => id)
        
        if (personIds.length === 0) return 'No participants recorded'
        
        // Get person details
        const participants = personIds.map(personId => {
            const person = people.find(p => p.id === personId)
            return person ? `${person.firstName} ${person.lastName} (${person.role?.replace('_', ' ')})` : personId
        })
        
        return participants.join(', ')
    }

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleString()
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1200, margin: '20px auto', padding: 12}}>
                    <h2>Canvassing History</h2>
                    <p>Loading interaction history...</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '20px auto', padding: 12}}>
                <h2>Canvassing History</h2>
                <p>Chronological list of all canvassing interactions. Filter by property address using URL parameter.</p>
                
                {/* Filter Display and Controls */}
                <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                }}>
                    {filteredAddress ? (
                        <>
                            <span style={{fontWeight: 'bold'}}>
                                Filtered by address: "{filteredAddress}"
                            </span>
                            <button
                                onClick={clearAddressFilter}
                                style={{
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Show All Interactions
                            </button>
                        </>
                    ) : (
                        <span>Showing all interactions across all properties</span>
                    )}
                </div>

                {/* Stats and Pagination Info */}
                <div style={{marginBottom: 20, fontSize: '0.9em', color: '#666'}}>
                    {filteredAddress ? 
                        `Found ${totalInteractions} interactions at properties matching "${filteredAddress}"` :
                        `Showing ${totalInteractions} total interactions`
                    }
                    {totalInteractions > ITEMS_PER_PAGE && (
                        <span style={{marginLeft: 16}}>
                            (Page {currentPage} of {totalPages} - showing entries {startIndex}-{endIndex})
                        </span>
                    )}
                </div>

                {/* Interactions Table */}
                {interactions.length > 0 ? (
                    <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                            <thead>
                                <tr style={{backgroundColor: '#f8f9fa'}}>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Date & Time</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Address</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Participants</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Contact Made</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Materials</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Notes</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Recorded By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {interactions.map(interaction => {
                                    const home = getHomeForInteraction(interaction)
                                    return (
                                        <tr key={interaction.id}>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                {formatDate(interaction.createdAt)}
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                {home ? (
                                                    <div>
                                                        <div style={{fontWeight: 'bold'}}>{home.street}</div>
                                                        <div style={{fontSize: '0.9em', color: '#666'}}>
                                                            {home.city}, {home.state} {home.postalCode}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{color: '#dc3545'}}>Home not found</span>
                                                )}
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                <div style={{fontSize: '0.9em'}}>
                                                    {getParticipantsDisplay(interaction)}
                                                </div>
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                <div style={{fontSize: '0.9em'}}>
                                                    {interaction.spokeToHomeowner && (
                                                        <div style={{color: '#28a745'}}>✓ Spoke to homeowner</div>
                                                    )}
                                                    {interaction.spokeToOther && (
                                                        <div style={{color: '#17a2b8'}}>✓ Spoke to other resident</div>
                                                    )}
                                                    {!interaction.spokeToHomeowner && !interaction.spokeToOther && (
                                                        <div style={{color: '#6c757d'}}>No contact made</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                <div style={{fontSize: '0.9em'}}>
                                                    {interaction.leftFlyer ? (
                                                        <div style={{color: '#28a745'}}>✓ Left flyer</div>
                                                    ) : (
                                                        <div style={{color: '#6c757d'}}>No materials left</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                <div style={{fontSize: '0.9em', maxWidth: 200}}>
                                                    {interaction.notes || <span style={{color: '#6c757d'}}>No notes</span>}
                                                </div>
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                <div style={{fontSize: '0.9em'}}>
                                                    {interaction.createdBy || 'Unknown'}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: 40,
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8,
                        color: '#666'
                    }}>
                        {filteredAddress ? 
                            `No interactions found for properties matching "${filteredAddress}". Try clearing the filter to see all interactions.` :
                            'No canvassing interactions have been recorded yet.'
                        }
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 16,
                        marginTop: 24,
                        padding: 16,
                        backgroundColor: '#f8f9fa',
                        borderRadius: 8
                    }}>
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            style={{
                                backgroundColor: currentPage === 1 ? '#e9ecef' : '#007bff',
                                color: currentPage === 1 ? '#6c757d' : 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: currentPage === 1 ? 'default' : 'pointer',
                                opacity: currentPage === 1 ? 0.6 : 1
                            }}
                        >
                            Previous
                        </button>

                        <div style={{display: 'flex', gap: 8}}>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => goToPage(pageNum)}
                                        style={{
                                            backgroundColor: pageNum === currentPage ? '#007bff' : '#fff',
                                            color: pageNum === currentPage ? 'white' : '#007bff',
                                            border: '1px solid #007bff',
                                            padding: '8px 12px',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontWeight: pageNum === currentPage ? 'bold' : 'normal'
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            style={{
                                backgroundColor: currentPage === totalPages ? '#e9ecef' : '#007bff',
                                color: currentPage === totalPages ? '#6c757d' : 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: currentPage === totalPages ? 'default' : 'pointer',
                                opacity: currentPage === totalPages ? 0.6 : 1
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
