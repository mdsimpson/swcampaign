import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function Organize() {
    const [homes, setHomes] = useState<any[]>([])
    const [volunteers, setVolunteers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedHomes, setSelectedHomes] = useState<Set<string>>(new Set())
    const [assignToVolunteer, setAssignToVolunteer] = useState('')
    
    // Filter state
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [assignmentFilter, setAssignmentFilter] = useState('all')
    
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

    useEffect(() => {
        loadData()
    }, [currentPage, sortField, sortDirection])
    
    // Get appropriate nextToken for current page
    function getNextTokenForPage() {
        if (currentPage === 1) return null
        return previousTokens[currentPage - 2] || null
    }

    async function loadData() {
        try {
            setLoading(true)
            
            // Build filter for homes - temporarily remove absentee filter for debugging
            let homeFilter: any = {} // { absenteeOwner: { ne: true } }
            
            // Add search filter if applied
            if (searchTerm.trim()) {
                homeFilter = {
                    and: [
                        homeFilter,
                        {
                            or: [
                                { street: { contains: searchTerm.trim() } },
                                { city: { contains: searchTerm.trim() } }
                            ]
                        }
                    ]
                }
            }
            
            // Load homes with pagination and sorting
            const homesResult = await client.models.Home.list({
                filter: homeFilter,
                limit: pageSize,
                nextToken: getNextTokenForPage()
            })
            
            // Store nextToken for pagination
            if (homesResult.nextToken && !previousTokens.includes(homesResult.nextToken)) {
                setPreviousTokens(prev => {
                    const newTokens = [...prev]
                    newTokens[currentPage - 1] = homesResult.nextToken!
                    return newTokens
                })
            }
            setNextToken(homesResult.nextToken || null)
            
            const loadedHomes = homesResult.data
            
            // Load related data for each home
            const homesWithDetails = await Promise.all(
                loadedHomes.map(async (home) => {
                    const [residentsResult, consentsResult, assignmentsResult] = await Promise.all([
                        client.models.Person.list({ filter: { homeId: { eq: home.id } } }),
                        client.models.Consent.list({ filter: { homeId: { eq: home.id } } }),
                        client.models.Assignment.list({ filter: { homeId: { eq: home.id } } })
                    ])
                    
                    const residents = residentsResult.data
                    const consents = consentsResult.data
                    const assignments = assignmentsResult.data.filter(a => a.status !== 'DONE')
                    
                    // Determine consent status
                    const allOwnersSigned = residents.length > 0 && 
                        residents.every(resident => resident.hasSigned)
                    
                    return { 
                        ...home, 
                        residents, 
                        consents,
                        assignments,
                        consentStatus: allOwnersSigned ? 'complete' : 'incomplete'
                    }
                })
            )
            
            // Apply additional filters that can't be done at DB level
            let filteredData = homesWithDetails
            
            if (statusFilter !== 'all') {
                filteredData = filteredData.filter(home => home.consentStatus === statusFilter)
            }
            
            if (assignmentFilter !== 'all') {
                if (assignmentFilter === 'assigned') {
                    filteredData = filteredData.filter(home => home.assignments.length > 0)
                } else if (assignmentFilter === 'unassigned') {
                    filteredData = filteredData.filter(home => home.assignments.length === 0)
                }
            }
            
            // Apply sorting
            filteredData.sort((a, b) => {
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
                    case 'consentStatus':
                        aVal = a.consentStatus
                        bVal = b.consentStatus
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
            
            setHomes(filteredData)
            // For total count approximation (GraphQL doesn't provide exact counts)
            if (currentPage === 1) {
                // Rough estimate: if we got a full page, there are likely more
                const estimatedTotal = homesResult.nextToken ? pageSize * 10 : filteredData.length
                setTotalCount(estimatedTotal)
            }
            
            // Load volunteers if not already loaded
            if (volunteers.length === 0) {
                const volunteersResult = await client.models.Volunteer.list()
                setVolunteers(volunteersResult.data)
            }
            
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }
    
    function applyFilters() {
        setCurrentPage(1) // Reset to first page when filters change
        setSelectedHomes(new Set()) // Clear selections
        setPreviousTokens([]) // Clear pagination tokens
        setNextToken(null)
        loadData()
    }
    
    function handleSort(field: string) {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    function toggleHomeSelection(homeId: string) {
        const newSelected = new Set(selectedHomes)
        if (newSelected.has(homeId)) {
            newSelected.delete(homeId)
        } else {
            newSelected.add(homeId)
        }
        setSelectedHomes(newSelected)
    }

    function selectAll() {
        const allIds = new Set(homes.map(home => home.id))
        setSelectedHomes(allIds)
    }

    function clearSelection() {
        setSelectedHomes(new Set())
    }

    async function assignSelectedHomes() {
        if (!assignToVolunteer || selectedHomes.size === 0) {
            alert('Please select homes and a volunteer')
            return
        }

        try {
            const assignments = Array.from(selectedHomes).map(homeId => ({
                homeId,
                volunteerId: assignToVolunteer,
                assignedAt: new Date().toISOString(),
                status: 'NOT_STARTED'
            }))

            await Promise.all(
                assignments.map(assignment => 
                    client.models.Assignment.create(assignment)
                )
            )

            alert(`Assigned ${selectedHomes.size} homes successfully`)
            setSelectedHomes(new Set())
            setAssignToVolunteer('')
            loadData() // Refresh data
        } catch (error) {
            console.error('Failed to assign homes:', error)
            alert('Failed to assign homes')
        }
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1100, margin: '20px auto'}}>
                    <h2>Organize Canvassing</h2>
                    <p>Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1400, margin: '20px auto', padding: 12}}>
                <h2>Organize Canvassing</h2>
                <p>Assign homes to canvassers and track progress. Showing non-absentee homes only.</p>
                
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
                            placeholder="Address or city..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        />
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Consent Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="all">All</option>
                            <option value="incomplete">Incomplete</option>
                            <option value="complete">Complete</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Assignment:</label>
                        <select
                            value={assignmentFilter}
                            onChange={(e) => setAssignmentFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="all">All</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
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

                {/* Bulk Actions */}
                <div style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 16,
                    alignItems: 'center',
                    backgroundColor: '#e9ecef',
                    padding: 16,
                    borderRadius: 8
                }}>
                    <div>
                        <strong>{selectedHomes.size}</strong> homes selected
                    </div>
                    
                    <button
                        onClick={selectAll}
                        style={{
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Select All ({homes.length})
                    </button>
                    
                    <button
                        onClick={clearSelection}
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Clear Selection
                    </button>
                    
                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                        <select
                            value={assignToVolunteer}
                            onChange={(e) => setAssignToVolunteer(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="">Select volunteer...</option>
                            {volunteers.map(volunteer => (
                                <option key={volunteer.id} value={volunteer.id}>
                                    {volunteer.displayName || volunteer.email}
                                </option>
                            ))}
                        </select>
                        
                        <button
                            onClick={assignSelectedHomes}
                            disabled={selectedHomes.size === 0 || !assignToVolunteer}
                            style={{
                                backgroundColor: selectedHomes.size > 0 && assignToVolunteer ? '#28a745' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: selectedHomes.size > 0 && assignToVolunteer ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Assign Selected
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div style={{marginBottom: 16, fontSize: '0.9em', color: '#666'}}>
                    Showing {homes.length} homes on page {currentPage} {nextToken ? '(more pages available)' : '(last page)'}
                </div>

                {/* Table */}
                <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{backgroundColor: '#f8f9fa'}}>
                                <th style={{border: '1px solid #ddd', padding: 8, width: 40}}>
                                    <input
                                        type="checkbox"
                                        checked={homes.length > 0 && selectedHomes.size === homes.length}
                                        onChange={() => selectedHomes.size === homes.length ? clearSelection() : selectAll()}
                                    />
                                </th>
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
                                    Address {sortField === 'street' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Residents</th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'consentStatus' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('consentStatus')}
                                >
                                    Consent Status {sortField === 'consentStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Assignment</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {homes.map(home => (
                                <tr key={home.id} style={{backgroundColor: selectedHomes.has(home.id) ? '#e3f2fd' : 'white'}}>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <input
                                            type="checkbox"
                                            checked={selectedHomes.has(home.id)}
                                            onChange={() => toggleHomeSelection(home.id)}
                                        />
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {/* Handle case where unitNumber and street might contain duplicate data */}
                                        {home.unitNumber && home.street && home.unitNumber !== home.street 
                                            ? `${home.unitNumber} ${home.street}` 
                                            : (home.street || home.unitNumber)
                                        }<br/>
                                        <span style={{fontSize: '0.9em', color: '#666'}}>
                                            {home.city}, {home.state} {home.postalCode}
                                        </span>
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {home.residents?.map((resident: any, i: number) => (
                                            <div key={resident.id} style={{marginBottom: 4}}>
                                                {resident.firstName} {resident.lastName}
                                                <span style={{fontSize: '0.8em', color: resident.hasSigned ? '#28a745' : '#dc3545'}}>
                                                    {resident.hasSigned ? ' ✓' : ' ✗'}
                                                </span>
                                                {resident.role && (
                                                    <span style={{fontSize: '0.8em', color: '#666'}}>
                                                        {' (' + resident.role.replace('_', ' ') + ')'}
                                                    </span>
                                                )}
                                            </div>
                                        )) || 'No residents'}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.8em',
                                            backgroundColor: home.consentStatus === 'complete' ? '#d4edda' : '#f8d7da',
                                            color: home.consentStatus === 'complete' ? '#155724' : '#721c24'
                                        }}>
                                            {home.consentStatus === 'complete' ? 'Complete' : 'Incomplete'}
                                        </span>
                                        <div style={{fontSize: '0.8em', color: '#666', marginTop: 4}}>
                                            {home.consents.length} of {home.residents.length} signed
                                        </div>
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {home.assignments.length > 0 ? (
                                            home.assignments.map((assignment: any) => (
                                                <div key={assignment.id} style={{fontSize: '0.9em'}}>
                                                    {volunteers.find(v => v.id === assignment.volunteerId)?.displayName || 'Unknown'}
                                                    <div style={{fontSize: '0.8em', color: '#666'}}>
                                                        {assignment.status.replace('_', ' ')}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <span style={{color: '#666', fontSize: '0.9em'}}>Unassigned</span>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <button
                                            onClick={() => window.open(`/history?address=${encodeURIComponent(home.street)}`, '_blank')}
                                            style={{
                                                backgroundColor: '#17a2b8',
                                                color: 'white',
                                                border: 'none',
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                fontSize: '0.8em'
                                            }}
                                        >
                                            View History
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {(nextToken || currentPage > 1) && (
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
                            Page {currentPage} {nextToken ? '(more pages available)' : '(last page)'}
                        </span>
                        
                        <button
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            disabled={!nextToken}
                            style={{
                                backgroundColor: nextToken ? '#007bff' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                cursor: nextToken ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}

                {homes.length === 0 && !loading && (
                    <div style={{textAlign: 'center', padding: 40, color: '#666'}}>
                        No homes match the current filters.
                    </div>
                )}
            </div>
        </div>
    )
}
