import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import { useLocation, useNavigate } from 'react-router-dom'

export default function EditAddresses() {
    const location = useLocation()
    const navigate = useNavigate()

    const [addresses, setAddresses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingAddress, setEditingAddress] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<any>({})

    // Initialize filter state from URL params
    const initializeFiltersFromURL = () => {
        const params = new URLSearchParams(location.search)
        return {
            streetFilter: params.get('street') || '',
            cityFilter: params.get('city') || '',
            page: parseInt(params.get('page') || '1')
        }
    }

    // Filter state
    const [streetFilter, setStreetFilter] = useState(() => initializeFiltersFromURL().streetFilter)
    const [cityFilter, setCityFilter] = useState(() => initializeFiltersFromURL().cityFilter)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(() => initializeFiltersFromURL().page)
    const [totalCount, setTotalCount] = useState(0)
    const pageSize = 50

    // Sorting state
    const [sortField, setSortField] = useState('street')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    const client = generateClient<Schema>()

    useEffect(() => {
        loadData()
    }, [currentPage, sortField, sortDirection])

    // Update URL when filters change
    const updateURL = (updates: Partial<{
        street: string
        city: string
        page: number
    }>) => {
        const params = new URLSearchParams(location.search)

        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== '' && value !== 1) {
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

            // Load all addresses
            let allAddresses: any[] = []
            let nextToken = null

            do {
                const addressResult = await client.models.Address.list({
                    limit: 100,
                    nextToken
                })
                allAddresses.push(...addressResult.data)
                nextToken = addressResult.nextToken
            } while (nextToken)

            // Apply filters
            let filteredAddresses = allAddresses

            if (streetFilter.trim()) {
                const streetLower = streetFilter.toLowerCase()
                filteredAddresses = filteredAddresses.filter(address =>
                    address.street?.toLowerCase().includes(streetLower)
                )
            }

            if (cityFilter.trim()) {
                const cityLower = cityFilter.toLowerCase()
                filteredAddresses = filteredAddresses.filter(address =>
                    address.city?.toLowerCase().includes(cityLower)
                )
            }

            // Apply sorting
            filteredAddresses.sort((a, b) => {
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
                    case 'zip':
                        aVal = a.zip || ''
                        bVal = b.zip || ''
                        break
                    case 'deed':
                        aVal = a.deed || ''
                        bVal = b.deed || ''
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

            // Update total count
            setTotalCount(filteredAddresses.length)

            // Apply pagination
            const startIndex = (currentPage - 1) * pageSize
            const endIndex = startIndex + pageSize
            const currentPageAddresses = filteredAddresses.slice(startIndex, endIndex)

            setAddresses(currentPageAddresses)

        } catch (error) {
            console.error('Failed to load addresses:', error)
        } finally {
            setLoading(false)
        }
    }

    function applyFilters() {
        setCurrentPage(1)

        updateURL({
            street: streetFilter,
            city: cityFilter,
            page: 1
        })

        loadData()
    }

    function clearFilters() {
        setStreetFilter('')
        setCityFilter('')
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

    function startEditing(address: any) {
        setEditingAddress(address.id)
        setEditForm({
            street: address.street || '',
            city: address.city || '',
            state: address.state || 'VA',
            zip: address.zip || '',
            lat: address.lat || '',
            lng: address.lng || '',
            deed: address.deed || '',
            notes: address.notes || ''
        })
    }

    function cancelEditing() {
        setEditingAddress(null)
        setEditForm({})
    }

    async function saveEditing() {
        if (!editingAddress) return

        try {
            // Convert lat/lng to numbers or null
            const lat = editForm.lat === '' ? null : parseFloat(editForm.lat)
            const lng = editForm.lng === '' ? null : parseFloat(editForm.lng)

            const updatedAddress = await client.models.Address.update({
                id: editingAddress,
                street: editForm.street,
                city: editForm.city,
                state: editForm.state,
                zip: editForm.zip,
                lat: lat,
                lng: lng,
                deed: editForm.deed,
                notes: editForm.notes
            })

            if (updatedAddress.data) {
                // Update the address in the current state instead of reloading
                setAddresses(prevAddresses =>
                    prevAddresses.map(address =>
                        address.id === editingAddress
                            ? { ...address, ...updatedAddress.data }
                            : address
                    )
                )
            }

            setEditingAddress(null)
            setEditForm({})
            alert('Address updated successfully!')
        } catch (error) {
            console.error('Failed to update address:', error)
            alert('Failed to update address')
        }
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1400, margin: '20px auto', padding: 12}}>
                <h2>Edit Addresses</h2>
                <p>Search for and edit address information including street, city, coordinates, and deed holder.</p>

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
                        <label style={{display: 'block', marginBottom: 4}}>Street:</label>
                        <input
                            type="text"
                            value={streetFilter}
                            onChange={(e) => setStreetFilter(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters()
                                }
                            }}
                            placeholder="Enter street address..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd', width: 250}}
                        />
                    </div>

                    <div>
                        <label style={{display: 'block', marginBottom: 4}}>City:</label>
                        <input
                            type="text"
                            value={cityFilter}
                            onChange={(e) => setCityFilter(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters()
                                }
                            }}
                            placeholder="Enter city..."
                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd', width: 200}}
                        />
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
                    Showing {addresses.length} addresses on page {currentPage} of {Math.ceil(totalCount / pageSize)} (Total: {totalCount} addresses)
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
                                        backgroundColor: sortField === 'street' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('street')}
                                >
                                    Street {sortField === 'street' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: 8,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'city' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('city')}
                                >
                                    City {sortField === 'city' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>State</th>
                                <th
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: 8,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'zip' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('zip')}
                                >
                                    ZIP {sortField === 'zip' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Coordinates</th>
                                <th
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: 8,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        backgroundColor: sortField === 'deed' ? '#e9ecef' : 'transparent'
                                    }}
                                    onClick={() => handleSort('deed')}
                                >
                                    Deed Holder {sortField === 'deed' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Notes</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} style={{
                                        border: '1px solid #ddd',
                                        padding: 40,
                                        textAlign: 'center',
                                        color: '#666'
                                    }}>
                                        Loading addresses...
                                    </td>
                                </tr>
                            ) : addresses.map(address => (
                                <tr key={address.id}>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <input
                                                type="text"
                                                value={editForm.street}
                                                onChange={(e) => setEditForm({...editForm, street: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            address.street || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <input
                                                type="text"
                                                value={editForm.city}
                                                onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            address.city || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <input
                                                type="text"
                                                value={editForm.state}
                                                onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            address.state || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <input
                                                type="text"
                                                value={editForm.zip}
                                                onChange={(e) => setEditForm({...editForm, zip: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            address.zip || '-'
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <div style={{fontSize: '0.8em'}}>
                                                <div style={{marginBottom: 2}}>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>Lat:</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.lat}
                                                        onChange={(e) => setEditForm({...editForm, lat: e.target.value})}
                                                        style={{width: '100%', padding: 2, border: '1px solid #ddd', borderRadius: 2}}
                                                        placeholder="e.g., 38.9072"
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{fontSize: '0.7em', color: '#666'}}>Lng:</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.lng}
                                                        onChange={(e) => setEditForm({...editForm, lng: e.target.value})}
                                                        style={{width: '100%', padding: 2, border: '1px solid #ddd', borderRadius: 2}}
                                                        placeholder="e.g., -77.0369"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{fontSize: '0.8em'}}>
                                                {address.lat && address.lng ? (
                                                    <>
                                                        <div>{address.lat.toFixed(4)}</div>
                                                        <div>{address.lng.toFixed(4)}</div>
                                                    </>
                                                ) : '-'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <input
                                                type="text"
                                                value={editForm.deed}
                                                onChange={(e) => setEditForm({...editForm, deed: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4}}
                                            />
                                        ) : (
                                            <div style={{fontSize: '0.9em', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                {address.deed || '-'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
                                            <textarea
                                                value={editForm.notes}
                                                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                                                style={{width: '100%', padding: 4, border: '1px solid #ddd', borderRadius: 4, minHeight: 60}}
                                            />
                                        ) : (
                                            <div style={{fontSize: '0.8em', maxWidth: 200, maxHeight: 60, overflow: 'auto'}}>
                                                {address.notes || '-'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {editingAddress === address.id ? (
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
                                                onClick={() => startEditing(address)}
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
                                    street: streetFilter,
                                    city: cityFilter,
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
                                    street: streetFilter,
                                    city: cityFilter,
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

                {addresses.length === 0 && !loading && (
                    <div style={{textAlign: 'center', padding: 40, color: '#666'}}>
                        No addresses match the current filters.
                    </div>
                )}
            </div>
        </div>
    )
}
