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
    const [addresses, setAddresses] = useState<any[]>([])
    const [residents, setResidents] = useState<any[]>([])
    const [userProfiles, setUserProfiles] = useState<any[]>([])
    const [volunteers, setVolunteers] = useState<any[]>([])
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
            
            // Load all addresses for address filtering and display
            let allAddresses: any[] = []
            let addressesNextToken = null
            
            do {
                const result = await client.models.Address.list({
                    limit: 1000,
                    nextToken: addressesNextToken
                })
                allAddresses.push(...result.data)
                addressesNextToken = result.nextToken
            } while (addressesNextToken)
            
            setAddresses(allAddresses)
            console.log(`Loaded ${allAddresses.length} total addresses`)
            
            // Load all residents for participant display
            let allResidents: any[] = []
            let residentsNextToken = null
            
            do {
                const result = await client.models.Resident.list({
                    limit: 1000,
                    nextToken: residentsNextToken
                })
                allResidents.push(...result.data)
                residentsNextToken = result.nextToken
            } while (residentsNextToken)
            
            setResidents(allResidents)
            console.log(`Loaded ${allResidents.length} total residents`)
            
            // Load all user profiles for canvasser names
            let allUserProfiles: any[] = []
            let userProfilesNextToken = null
            
            try {
                do {
                    const result = await client.models.UserProfile.list({
                        limit: 1000,
                        nextToken: userProfilesNextToken
                    })
                    allUserProfiles.push(...result.data)
                    userProfilesNextToken = result.nextToken
                } while (userProfilesNextToken)
                
                setUserProfiles(allUserProfiles)
                console.log(`Loaded ${allUserProfiles.length} total user profiles`)
            } catch (error) {
                console.log('Could not load user profiles:', error)
                setUserProfiles([])
            }
            
            // Load all volunteers for canvasser names (backup if no UserProfile)
            let allVolunteers: any[] = []
            let volunteersNextToken = null
            
            try {
                do {
                    const result = await client.models.Volunteer.list({
                        limit: 1000,
                        nextToken: volunteersNextToken
                    })
                    allVolunteers.push(...result.data)
                    volunteersNextToken = result.nextToken
                } while (volunteersNextToken)
                
                setVolunteers(allVolunteers)
                console.log(`Loaded ${allVolunteers.length} total volunteers`)
            } catch (error) {
                console.log('Could not load volunteers:', error)
                setVolunteers([])
            }
            
            // Filter interactions by address if specified
            let filteredInteractions = allInteractions
            
            if (addressFilter.trim()) {
                console.log(`Filtering interactions for address: "${addressFilter}"`)
                
                // Find addresses that match the address filter
                const matchingAddresses = allAddresses.filter(address => 
                    address.street?.toLowerCase().includes(addressFilter.toLowerCase())
                )
                const matchingAddressIds = new Set(matchingAddresses.map(a => a.id))
                
                console.log(`Found ${matchingAddresses.length} addresses matching address filter`)
                
                // Filter interactions to only those at matching addresses
                filteredInteractions = allInteractions.filter(interaction => 
                    matchingAddressIds.has(interaction.addressId)
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

    function getAddressForInteraction(interaction: any) {
        return addresses.find(a => a.id === interaction.addressId)
    }

    function getCanvasserName(interaction: any) {
        // First try to find the user profile by sub/userId
        const userProfile = userProfiles.find(profile => 
            profile.sub === interaction.createdBy || 
            profile.email === interaction.createdBy
        )
        
        if (userProfile && userProfile.firstName && userProfile.lastName) {
            return `${userProfile.firstName} ${userProfile.lastName}`
        }
        
        // If no UserProfile, try to find in Volunteer records
        const volunteer = volunteers.find(vol => 
            vol.userSub === interaction.createdBy || 
            vol.email === interaction.createdBy
        )
        
        if (volunteer && volunteer.displayName) {
            return volunteer.displayName
        }
        
        // If still no match, return the createdBy value or Unknown
        return interaction.createdBy || 'Unknown'
    }

    function getParticipantsDisplay(interaction: any) {
        if (!interaction.participantResidentIds) {
            // If no participants recorded, show who canvassed instead
            return `Canvassed by ${interaction.createdBy || 'Unknown'}`
        }
        
        // Parse CSV of resident IDs and names
        const participantIds = interaction.participantResidentIds.split(',').map(id => id.trim()).filter(id => id)
        
        if (participantIds.length === 0) {
            // If empty string for participants, show who canvassed
            return `Canvassed by ${interaction.createdBy || 'Unknown'}`
        }
        
        // Get resident details
        const participants = participantIds.map(participantId => {
            // First try to find by resident ID
            const resident = residents.find(r => r.id === participantId)
            if (resident) {
                const roleValue = resident.role || resident.occupantType || 'resident'
                const roleDisplay = roleValue.replace('_', ' ').toLowerCase()
                return `${resident.firstName} ${resident.lastName} (${roleDisplay})`
            }
            // If not found, it might be a name string (for "other person")
            return participantId
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
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Recorded by</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Contact Made</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Materials</th>
                                    <th style={{border: '1px solid #ddd', padding: 12, textAlign: 'left'}}>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {interactions.map(interaction => {
                                    const address = getAddressForInteraction(interaction)
                                    return (
                                        <tr key={interaction.id}>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                {formatDate(interaction.createdAt)}
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                {address ? (
                                                    <div>
                                                        <div style={{fontWeight: 'bold'}}>{address.street}</div>
                                                        <div style={{fontSize: '0.9em', color: '#666'}}>
                                                            {address.city}, {address.state} {address.zip}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{color: '#dc3545'}}>Address not found</span>
                                                )}
                                            </td>
                                            <td style={{border: '1px solid #ddd', padding: 12}}>
                                                <div style={{fontSize: '0.9em', fontWeight: 'bold'}}>
                                                    {getCanvasserName(interaction)}
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
