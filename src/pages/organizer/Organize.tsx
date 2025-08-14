import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function Organize() {
    const [homes, setHomes] = useState<any[]>([])
    const [filteredHomes, setFilteredHomes] = useState<any[]>([])
    const [volunteers, setVolunteers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedHomes, setSelectedHomes] = useState<Set<string>>(new Set())
    const [assignToVolunteer, setAssignToVolunteer] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [assignmentFilter, setAssignmentFilter] = useState('all')

    const client = generateClient<Schema>()

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        applyFilters()
    }, [homes, searchTerm, statusFilter, assignmentFilter])

    async function loadData() {
        try {
            // Load homes
            const homesResult = await client.models.Home.list()
            const nonAbsenteeHomes = homesResult.data.filter(home => !home.absenteeOwner)
            
            // Load residents and consents for each home
            const homesWithDetails = await Promise.all(
                nonAbsenteeHomes.map(async (home) => {
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
            
            setHomes(homesWithDetails)
            
            // Load volunteers
            const volunteersResult = await client.models.Volunteer.list()
            setVolunteers(volunteersResult.data)
            
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoading(false)
        }
    }

    function applyFilters() {
        let filtered = homes

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(home => 
                home.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
                home.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                home.residents?.some((resident: any) => 
                    `${resident.firstName} ${resident.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(home => home.consentStatus === statusFilter)
        }

        // Assignment filter
        if (assignmentFilter !== 'all') {
            if (assignmentFilter === 'assigned') {
                filtered = filtered.filter(home => home.assignments.length > 0)
            } else if (assignmentFilter === 'unassigned') {
                filtered = filtered.filter(home => home.assignments.length === 0)
            }
        }

        setFilteredHomes(filtered)
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
        const allIds = new Set(filteredHomes.map(home => home.id))
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
                    borderRadius: 8
                }}>
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Search:</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Address or resident name..."
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
                        Select All ({filteredHomes.length})
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
                    Showing {filteredHomes.length} of {homes.length} homes
                </div>

                {/* Table */}
                <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{backgroundColor: '#f8f9fa'}}>
                                <th style={{border: '1px solid #ddd', padding: 8, width: 40}}>
                                    <input
                                        type="checkbox"
                                        checked={filteredHomes.length > 0 && selectedHomes.size === filteredHomes.length}
                                        onChange={() => selectedHomes.size === filteredHomes.length ? clearSelection() : selectAll()}
                                    />
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Address</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Residents</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Consent Status</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Assignment</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHomes.map(home => (
                                <tr key={home.id} style={{backgroundColor: selectedHomes.has(home.id) ? '#e3f2fd' : 'white'}}>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <input
                                            type="checkbox"
                                            checked={selectedHomes.has(home.id)}
                                            onChange={() => toggleHomeSelection(home.id)}
                                        />
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {home.unitNumber && `${home.unitNumber} `}{home.street}<br/>
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

                {filteredHomes.length === 0 && (
                    <div style={{textAlign: 'center', padding: 40, color: '#666'}}>
                        No homes match the current filters.
                    </div>
                )}
            </div>
        </div>
    )
}
