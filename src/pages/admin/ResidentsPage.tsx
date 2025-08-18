import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import { useLocation, useNavigate } from 'react-router-dom'

export default function ResidentsPage() {
    const location = useLocation()
    const navigate = useNavigate()
    
    const [residents, setResidents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingResident, setEditingResident] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<any>({})
    
    // Initialize filter state from URL params
    const initializeFiltersFromURL = () => {
        const params = new URLSearchParams(location.search)
        return {
            nameFilter: params.get('name') || '',
            addressFilter: params.get('address') || '',
            occupantTypeFilter: params.get('type') || 'all',
            signedFilter: params.get('signed') || 'all',
            page: parseInt(params.get('page') || '1')
        }
    }
    
    // Filter state
    const [nameFilter, setNameFilter] = useState(() => initializeFiltersFromURL().nameFilter)
    const [addressFilter, setAddressFilter] = useState(() => initializeFiltersFromURL().addressFilter)
    const [occupantTypeFilter, setOccupantTypeFilter] = useState(() => initializeFiltersFromURL().occupantTypeFilter)
    const [signedFilter, setSignedFilter] = useState(() => initializeFiltersFromURL().signedFilter)
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(() => initializeFiltersFromURL().page)
    const [totalCount, setTotalCount] = useState(0)
    const pageSize = 50
    
    // Sorting state
    const [sortField, setSortField] = useState('lastName')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const client = generateClient<Schema>()

    useEffect(() => {
        loadData()
    }, [currentPage, sortField, sortDirection])
    
    // Update URL when filters change
    const updateURL = (updates: Partial<{
        name: string
        address: string
        type: string
        signed: string
        page: number
    }>) => {
        const params = new URLSearchParams(location.search)
        
        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== '' && value !== 'all' && value !== 1) {
                params.set(key, value.toString())
            } else {
                params.delete(key)
            }
        })
        
        const newSearch = params.toString()
        const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname
        navigate(newPath, { replace: true })
    }

    async function loadData() {
        try {
            setLoading(true)
            
            // Load all residents with their addresses
            let allResidents: any[] = []
            let nextToken = null
            
            do {
                const residentsResult = await client.models.Resident.list({
                    limit: 100,
                    nextToken
                })
                allResidents.push(...residentsResult.data)
                nextToken = residentsResult.nextToken
            } while (nextToken)
            
            // Load all addresses for lookup
            let allAddresses: any[] = []
            let addressNextToken = null
            
            do {
                const addressResult = await client.models.Address.list({
                    limit: 100,
                    nextToken: addressNextToken
                })
                allAddresses.push(...addressResult.data)
                addressNextToken = addressResult.nextToken
            } while (addressNextToken)
            
            // Create address lookup map
            const addressMap = new Map()
            allAddresses.forEach(address => {
                addressMap.set(address.id, address)
            })
            
            // Add address details to residents
            const residentsWithAddresses = allResidents.map(resident => ({
                ...resident,
                address: addressMap.get(resident.addressId)
            }))
            
            // Apply filters
            let filteredResidents = residentsWithAddresses
            
            if (nameFilter.trim()) {
                const nameLower = nameFilter.toLowerCase()
                filteredResidents = filteredResidents.filter(resident => 
                    resident.firstName?.toLowerCase().includes(nameLower) ||
                    resident.lastName?.toLowerCase().includes(nameLower) ||
                    `${resident.firstName} ${resident.lastName}`.toLowerCase().includes(nameLower)
                )
            }
            
            if (addressFilter.trim()) {
                const addressLower = addressFilter.toLowerCase()
                filteredResidents = filteredResidents.filter(resident => 
                    resident.address?.street?.toLowerCase().includes(addressLower) ||
                    resident.address?.city?.toLowerCase().includes(addressLower)
                )
            }
            
            if (occupantTypeFilter !== 'all') {
                filteredResidents = filteredResidents.filter(resident => 
                    resident.occupantType === occupantTypeFilter
                )
            }
            
            if (signedFilter !== 'all') {
                if (signedFilter === 'signed') {
                    filteredResidents = filteredResidents.filter(resident => resident.hasSigned)
                } else if (signedFilter === 'not_signed') {
                    filteredResidents = filteredResidents.filter(resident => !resident.hasSigned)
                }
            }
            
            // Apply sorting
            filteredResidents.sort((a, b) => {
                let aVal: any, bVal: any
                
                switch (sortField) {
                    case 'firstName':
                        aVal = a.firstName || ''
                        bVal = b.firstName || ''
                        break
                    case 'lastName':
                        aVal = a.lastName || ''
                        bVal = b.lastName || ''
                        break
                    case 'occupantType':
                        aVal = a.occupantType || ''
                        bVal = b.occupantType || ''
                        break
                    case 'address':
                        aVal = a.address?.street || ''
                        bVal = b.address?.street || ''
                        break
                    case 'hasSigned':
                        aVal = a.hasSigned ? 1 : 0
                        bVal = b.hasSigned ? 1 : 0
                        break
                    default:
                        aVal = a.lastName || ''
                        bVal = b.lastName || ''
                }
                
                if (typeof aVal === 'string') {
                    const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
                    return sortDirection === 'asc' ? comparison : -comparison
                }
                
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
            
            // Update total count
            setTotalCount(filteredResidents.length)
            
            // Apply pagination
            const startIndex = (currentPage - 1) * pageSize
            const endIndex = startIndex + pageSize
            const currentPageResidents = filteredResidents.slice(startIndex, endIndex)
            
            setResidents(currentPageResidents)
            
        } catch (error) {
            console.error('Failed to load residents:', error)
        } finally {
            setLoading(false)
        }
    }
    
    function applyFilters() {
        setCurrentPage(1)
        
        updateURL({
            name: nameFilter,
            address: addressFilter,
            type: occupantTypeFilter,
            signed: signedFilter,
            page: 1
        })
        
        loadData()
    }
    
    function clearFilters() {
        setNameFilter('')
        setAddressFilter('')
        setOccupantTypeFilter('all')
        setSignedFilter('all')
        setCurrentPage(1)
        
        navigate(location.pathname, { replace: true })
        
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
    
    function startEditing(resident: any) {
        setEditingResident(resident.id)
        setEditForm({
            firstName: resident.firstName || '',
            lastName: resident.lastName || '',
            occupantType: resident.occupantType || '',
            contactEmail: resident.contactEmail || '',
            additionalEmail: resident.additionalEmail || '',
            cellPhone: resident.cellPhone || '',
            cellPhoneAlert: resident.cellPhoneAlert || '',
            unitPhone: resident.unitPhone || '',
            workPhone: resident.workPhone || '',
            isAbsentee: resident.isAbsentee || false
        })
    }
    
    function cancelEditing() {
        setEditingResident(null)
        setEditForm({})
    }
    
    async function saveEditing() {
        if (!editingResident) return
        
        try {
            const updatedResident = await client.models.Resident.update({
                id: editingResident,
                ...editForm
            })
            
            if (updatedResident.data) {
                // Update the resident in the current state instead of reloading
                setResidents(prevResidents => 
                    prevResidents.map(resident => 
                        resident.id === editingResident 
                            ? { ...resident, ...updatedResident.data }
                            : resident
                    )
                )
            }
            
            setEditingResident(null)
            setEditForm({})
            alert('Resident updated successfully!')
        } catch (error) {
            console.error('Failed to update resident:', error)
            alert('Failed to update resident')
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1400, margin: '20px auto', padding: 12}}>
                <h2>Edit Residents</h2>
                <p>Edit resident information. One row per resident with address reference.</p>
                
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
                        <label style={{display: 'block', marginBottom: 4}}>Name:</label>
                        <input
                            type="text"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters()
                                }
                            }}
                            placeholder="Enter resident name..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        />
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Address:</label>
                        <input
                            type="text"
                            value={addressFilter}
                            onChange={(e) => setAddressFilter(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters()
                                }
                            }}
                            placeholder="Enter address..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        />
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Occupant Type:</label>
                        <select
                            value={occupantTypeFilter}
                            onChange={(e) => setOccupantTypeFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="all">All</option>
                            <option value="Official Owner">Official Owner</option>
                            <option value="Official Co Owner">Official Co Owner</option>
                            <option value="RENTER">Renter</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>Signed Status:</label>
                        <select
                            value={signedFilter}
                            onChange={(e) => setSignedFilter(e.target.value)}
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                        >
                            <option value="all">All</option>
                            <option value="signed">Signed</option>
                            <option value="not_signed">Not Signed</option>
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
                    
                    <button
                        onClick={clearFilters}
                        style={{
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            cursor: 'pointer'
                        }}
                    >
                        Clear Filters
                    </button>
                </div>

                {/* Stats */}
                <div style={{marginBottom: 16, fontSize: '0.9em', color: '#666'}}>
                    Showing {residents.length} residents on page {currentPage} of {Math.ceil(totalCount / pageSize)} (Total: {totalCount} residents)
                </div>

                {/* Table */}
                <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{backgroundColor: '#f8f9fa'}}>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'firstName' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('firstName')}
                                >
                                    First Name {sortField === 'firstName' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'lastName' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('lastName')}
                                >
                                    Last Name {sortField === 'lastName' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'address' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('address')}
                                >
                                    Address {sortField === 'address' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'occupantType' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('occupantType')}
                                >
                                    Type {sortField === 'occupantType' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Contact Info</th>
                                <th 
                                    style={{
                                        border: '1px solid #ddd', 
                                        padding: 8, 
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'hasSigned' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('hasSigned')}
                                >
                                    Signed {sortField === 'hasSigned' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{
                                        border: '1px solid #ddd', 
                                        padding: 40, 
                                        textAlign: 'center',
                                        color: '#666'
                                    }}>
                                        Loading residents...
                                    </td>
                                </tr>
                            ) : residents.map(resident => (
                                <tr key={resident.id}>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingResident === resident.id ? (
                                            <input
                                                type="text"
                                                value={editForm.firstName}
                                                onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            resident.firstName || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingResident === resident.id ? (
                                            <input
                                                type="text"
                                                value={editForm.lastName}
                                                onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            resident.lastName || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <div style={{fontSize: '0.9em'}}>
                                            {resident.address?.street || 'No address'}<br/>
                                            <span style={{color: '#666', fontSize: '0.8em'}}>
                                                {resident.address?.city}, {resident.address?.state} {resident.address?.zip}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingResident === resident.id ? (
                                            <select
                                                value={editForm.occupantType}
                                                onChange={(e) => setEditForm({...editForm, occupantType: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            >
                                                <option value="">Select type...</option>
                                                <option value="Official Owner">Official Owner</option>
                                                <option value="Official Co Owner">Official Co Owner</option>
                                                <option value="RENTER">Renter</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        ) : (
                                            resident.occupantType || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingResident === resident.id ? (
                                            <div style={{fontSize: '0.8em'}}>
                                                <div style={{marginBottom: 4}}>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>Email:</label>
                                                    <input
                                                        type="email"
                                                        value={editForm.contactEmail}
                                                        onChange={(e) => setEditForm({...editForm, contactEmail: e.target.value})}
                                                        style={{width: '100%', padding: 2, border: '1px solid #ddd', borderRadius: 2}}
                                                    />
                                                </div>
                                                <div style={{marginBottom: 4}}>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>Additional Email:</label>
                                                    <input
                                                        type="email"
                                                        value={editForm.additionalEmail}
                                                        onChange={(e) => setEditForm({...editForm, additionalEmail: e.target.value})}
                                                        style={{width: '100%', padding: 2, border: '1px solid #ddd', borderRadius: 2}}
                                                    />
                                                </div>
                                                <div style={{marginBottom: 4}}>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>Cell Phone:</label>
                                                    <input
                                                        type="tel"
                                                        value={editForm.cellPhone}
                                                        onChange={(e) => setEditForm({...editForm, cellPhone: e.target.value})}
                                                        style={{width: '100%', padding: 2, border: '1px solid #ddd', borderRadius: 2}}
                                                    />
                                                </div>
                                                <div style={{marginBottom: 4}}>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>Work Phone:</label>
                                                    <input
                                                        type="tel"
                                                        value={editForm.workPhone}
                                                        onChange={(e) => setEditForm({...editForm, workPhone: e.target.value})}
                                                        style={{width: '100%', padding: 2, border: '1px solid #ddd', borderRadius: 2}}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>
                                                        <input
                                                            type="checkbox"
                                                            checked={editForm.isAbsentee}
                                                            onChange={(e) => setEditForm({...editForm, isAbsentee: e.target.checked})}
                                                        />
                                                        {' '}Absentee
                                                    </label>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{fontSize: '0.8em'}}>
                                                {resident.contactEmail && <div>{resident.contactEmail}</div>}
                                                {resident.additionalEmail && <div>{resident.additionalEmail}</div>}
                                                {resident.cellPhone && <div>Cell: {resident.cellPhone}</div>}
                                                {resident.workPhone && <div>Work: {resident.workPhone}</div>}
                                                {resident.isAbsentee && <div style={{color: '#007bff'}}>Absentee</div>}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.8em',
                                            backgroundColor: resident.hasSigned ? '#d4edda' : '#f8d7da',
                                            color: resident.hasSigned ? '#155724' : '#721c24'
                                        }}>
                                            {resident.hasSigned ? 'Yes' : 'No'}
                                        </span>
                                        {resident.signedAt && (
                                            <div style={{fontSize: '0.7em', color: '#666', marginTop: 2}}>
                                                {new Date(resident.signedAt).toLocaleDateString()}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingResident === resident.id ? (
                                            <div style={{display: 'flex', gap: 4}}>
                                                <button
                                                    onClick={saveEditing}
                                                    style={{
                                                        backgroundColor: '#28a745',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '4px 8px',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        fontSize: '0.8em'
                                                    }}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    style={{
                                                        backgroundColor: '#6c757d',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '4px 8px',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        fontSize: '0.8em'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEditing(resident)}
                                                style={{
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '4px 8px',
                                                    borderRadius: 4,
                                                    cursor: 'pointer',
                                                    fontSize: '0.8em'
                                                }}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

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
                            onClick={() => {
                                const newPage = Math.max(1, currentPage - 1)
                                setCurrentPage(newPage)
                                updateURL({
                                    name: nameFilter,
                                    address: addressFilter,
                                    type: occupantTypeFilter,
                                    signed: signedFilter,
                                    page: newPage
                                })
                            }}
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
                            onClick={() => {
                                const newPage = currentPage + 1
                                setCurrentPage(newPage)
                                updateURL({
                                    name: nameFilter,
                                    address: addressFilter,
                                    type: occupantTypeFilter,
                                    signed: signedFilter,
                                    page: newPage
                                })
                            }}
                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                            style={{
                                backgroundColor: currentPage < Math.ceil(totalCount / pageSize) ? '#007bff' : '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 4,
                                cursor: currentPage < Math.ceil(totalCount / pageSize) ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}

                {residents.length === 0 && !loading && (
                    <div style={{textAlign: 'center', padding: 40, color: '#666'}}>
                        No residents match the current filters.
                    </div>
                )}
            </div>
        </div>
    )
}