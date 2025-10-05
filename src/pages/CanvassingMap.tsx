import Header from '../components/Header'
import {useEffect, useState, useMemo, useCallback} from 'react'
import {GoogleMap, LoadScript, Marker, OverlayView} from '@react-google-maps/api'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {useAuthenticator} from '@aws-amplify/ui-react'
import { QUERY_LIMITS, loadAllRecords } from '../config/queries'

const mapContainerStyle = {
    width: '100%',
    height: '70vh'
}

const center = {
    lat: 38.9400,  // Adjusted to better center on Cloverleaf Ct area
    lng: -77.4100  // Broadlands, VA
}

// Static libraries array to prevent LoadScript reloads
const libraries = ['marker'] as const

export default function CanvassingMap() {
    const {user} = useAuthenticator(ctx => [ctx.user])
    const [allAddresses, setAllAddresses] = useState<any[]>([]) // All addresses in database
    const [viewportAddresses, setViewportAddresses] = useState<any[]>([]) // Addresses in current viewport
    const [assignments, setAssignments] = useState<any[]>([])
    const [showAll, setShowAll] = useState(false)
    const [selectedAddress, setSelectedAddress] = useState<any>(null)
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
    const [mapsLoaded, setMapsLoaded] = useState(false)
    const [mapInstance, setMapInstance] = useState(null)
    const [dataLoading, setDataLoading] = useState(true)
    const [viewportLoading, setViewportLoading] = useState(false)
    const [allResidents, setAllResidents] = useState<any[]>([]) // Cache all residents
    const [allConsents, setAllConsents] = useState<any[]>([]) // Cache all consents
    const [hasInitialBounds, setHasInitialBounds] = useState(false) // Track if we've set initial bounds
    const [toggleLoading, setToggleLoading] = useState(false) // Track toggle loading state
    
    const client = generateClient<Schema>()  // Use authenticated access instead of apiKey

    // Calculate which addresses to display based on filters
    const displayAddresses = useMemo(() => {
        if (!viewportAddresses.length) {
            return []
        }
        
        let filteredAddresses
        
        if (showAll) {
            // Show all addresses in viewport
            filteredAddresses = viewportAddresses
        } else {
            // Show only assigned addresses in viewport
            filteredAddresses = viewportAddresses.filter(h => 
                assignments.some(a => a.addressId === h.id)
            )
        }
        
        // Remove duplicates by address ID to prevent multiple markers at same location
        const uniqueAddresses = filteredAddresses.filter((address, index, array) => 
            array.findIndex(h => h.id === address.id) === index
        )
        
        
        // Add assignment status to each address for consistent marker coloring
        const addressesWithAssignmentStatus = uniqueAddresses.map(addr => ({
            ...addr,
            isAssigned: assignments.some(a => a.addressId === addr.id)
        }))

        // Enrich with resident data for display (if resident data is available)
        if (allResidents.length > 0) {
            const enrichedAddresses = enrichAddressesWithResidents(addressesWithAssignmentStatus)
            return enrichedAddresses
        } else {
            // Return basic address data if resident data not loaded yet
            return addressesWithAssignmentStatus.map(addr => ({ ...addr, residents: [] }))
        }
    }, [showAll, viewportAddresses, assignments, allResidents, allConsents])

    useEffect(() => {
        if (user?.userId) {
            loadInitialData() // Load assignments and all reference data
            getUserLocation()
        }
    }, [user])

    // Load addresses when map viewport changes OR when initial data loads
    useEffect(() => {
        if (mapInstance && mapsLoaded && allAddresses.length > 0) {
            // Load viewport addresses immediately when data is ready
            loadAddressesInViewport()
        }
    }, [mapInstance, mapsLoaded, allAddresses])

    // Also load viewport when map first loads with initial assignments (for proper bounds fitting)
    useEffect(() => {
        if (mapInstance && mapsLoaded && assignments.length > 0 && allAddresses.length > 0) {
            // For initial load, include assigned addresses in viewport to fit bounds properly
            const assignedAddressIds = assignments.map(a => a.addressId)
            const assignedAddresses = allAddresses.filter(addr => assignedAddressIds.includes(addr.id))
            
            if (assignedAddresses.length > 0) {
                setViewportAddresses(prev => {
                    // Merge assigned addresses with any existing viewport addresses
                    const combined = [...prev, ...assignedAddresses]
                    // Remove duplicates
                    const unique = combined.filter((addr, index, array) => 
                        array.findIndex(a => a.id === addr.id) === index
                    )
                    return unique
                })
            }
        }
    }, [mapInstance, mapsLoaded, assignments, allAddresses])

    // Debounced viewport change handler
    const handleViewportChange = useCallback(() => {
        if (!mapInstance || !allAddresses.length) return
        
        // Simple debounce - clear previous timeout and set new one
        const timeoutId = setTimeout(() => {
            loadAddressesInViewport()
        }, 500) // 500ms delay
        
        return timeoutId
    }, [mapInstance, allAddresses])

    // Clean debounce implementation
    const [viewportChangeTimeout, setViewportChangeTimeout] = useState<NodeJS.Timeout | null>(null)
    
    const debouncedViewportChange = useCallback(() => {
        if (viewportChangeTimeout) {
            clearTimeout(viewportChangeTimeout)
        }
        
        const timeout = setTimeout(() => {
            loadAddressesInViewport()
        }, 500)
        
        setViewportChangeTimeout(timeout)
    }, [viewportChangeTimeout])

    // Auto-fit map bounds to show all markers (ONLY on initial load)
    useEffect(() => {
        if (mapInstance && mapsLoaded && displayAddresses.length > 0 && !hasInitialBounds) {
            
            const bounds = new google.maps.LatLngBounds()
            let hasValidMarkers = false
            
            // Add all address markers to bounds
            displayAddresses.forEach(address => {
                if (address.lat && address.lng) {
                    bounds.extend(new google.maps.LatLng(address.lat, address.lng))
                    hasValidMarkers = true
                }
            })
            
            // Add user location if available
            if (userLocation) {
                bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng))
                hasValidMarkers = true
            }
            
            // Only fit bounds if we have at least one valid marker
            if (hasValidMarkers) {
                mapInstance.fitBounds(bounds)
                setHasInitialBounds(true) // Mark that we've set initial bounds
                
                // Add a listener to prevent over-zooming on single markers
                const listener = google.maps.event.addListenerOnce(mapInstance, 'bounds_changed', () => {
                    const currentZoom = mapInstance.getZoom()
                    if (currentZoom && currentZoom > 18) {
                        mapInstance.setZoom(18) // Max zoom level to prevent too close zoom
                    }
                })
                
            }
        }
    }, [mapInstance, mapsLoaded, displayAddresses, userLocation, hasInitialBounds])


    // Load addresses that are currently visible in the map viewport
    async function loadAddressesInViewport() {
        if (!mapInstance || viewportLoading) return
        
        try {
            setViewportLoading(true)
            
            // Get current map bounds
            const bounds = mapInstance.getBounds()
            if (!bounds) {
                // If no bounds yet, load assigned addresses as fallback
                if (assignments.length > 0) {
                    const assignedAddressIds = assignments.map(a => a.addressId)
                    const assignedAddresses = allAddresses.filter(addr => assignedAddressIds.includes(addr.id))
                    
                    // Deduplicate assigned addresses too
                    const uniqueAssignedAddresses = []
                    const seenAddresses = new Set()
                    
                    for (const address of assignedAddresses) {
                        const addressKey = `${address.street?.toLowerCase().trim()}, ${address.city?.toLowerCase().trim()}`
                        if (!seenAddresses.has(addressKey)) {
                            seenAddresses.add(addressKey)
                            uniqueAssignedAddresses.push(address)
                        }
                    }
                    
                    setViewportAddresses(uniqueAssignedAddresses)
                }
                return
            }
            
            const ne = bounds.getNorthEast()
            const sw = bounds.getSouthWest()
            
            // Filter addresses within viewport bounds
            const addressesInViewport = allAddresses.filter(address => {
                if (!address.lat || !address.lng) return false
                
                return address.lat >= sw.lat() && 
                       address.lat <= ne.lat() && 
                       address.lng >= sw.lng() && 
                       address.lng <= ne.lng()
            })
            
            // Deduplicate addresses in viewport by street address, keeping the first one found
            // (The enrichment function will find all residents from all duplicate records anyway)
            const uniqueViewportAddresses = []
            const seenAddresses = new Set()
            
            for (const address of addressesInViewport) {
                const addressKey = `${address.street?.toLowerCase().trim()}, ${address.city?.toLowerCase().trim()}`
                if (!seenAddresses.has(addressKey)) {
                    seenAddresses.add(addressKey)
                    uniqueViewportAddresses.push(address)
                }
            }
            
            setViewportAddresses(uniqueViewportAddresses)
            
        } catch (error) {
            console.error('Error loading viewport addresses:', error)
        } finally {
            setViewportLoading(false)
        }
    }

    async function loadInitialData() {
        try {
            setDataLoading(true)
            
            // Step 1: Load ALL addresses, residents, and consents for reference using centralized config
            const [loadedAddresses, loadedResidents, loadedConsents] = await Promise.all([
                loadAllRecords(
                    (config) => client.models.Address.list(config),
                    QUERY_LIMITS.ADDRESSES_BATCH_SIZE
                ),
                loadAllRecords(
                    (config) => client.models.Resident.list(config),
                    QUERY_LIMITS.RESIDENTS_BATCH_SIZE
                ),
                loadAllRecords(
                    (config) => client.models.Consent.list(config),
                    QUERY_LIMITS.CONSENTS_BATCH_SIZE
                )
            ])
            
            setAllAddresses(loadedAddresses)
            setAllResidents(loadedResidents)
            setAllConsents(loadedConsents)
            
            // Step 2: Get all volunteers to find the current user's volunteer record
            const volunteersResult = await client.models.Volunteer.list({ 
                limit: QUERY_LIMITS.VOLUNTEERS_LIMIT 
            })
            
            // Find the volunteer record for the current user
            const currentUserVolunteer = volunteersResult.data.find(v => 
                v.userSub === user?.userId || v.userSub === user?.username
            )
            
            if (!currentUserVolunteer) {
                setAssignments([])
                return
            }
            
            // Step 3: Get assignments for this volunteer
            const assignmentsResult = await client.models.Assignment.list({
                filter: { volunteerId: { eq: currentUserVolunteer.id } }
            })
            
            const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED')
            
            // Step 4: Just store the assignments - we'll load address details on demand for viewport
            setAssignments(activeAssignments)
            
        } catch (error) {
            console.error('💥 Failed to load initial data:', error)
        } finally {
            setDataLoading(false)
        }
    }

    // Function to enrich addresses with resident data for display
    function enrichAddressesWithResidents(addresses: any[]) {
        return addresses.map(address => {
            const addressKey = `${address.street?.toLowerCase().trim()}, ${address.city?.toLowerCase().trim()}`
            
            // Find ALL address IDs with the same street address (handling duplicates)
            const sameAddressIds = allAddresses
                .filter(a => {
                    const aAddress = `${a.street?.toLowerCase().trim()}, ${a.city?.toLowerCase().trim()}`
                    return aAddress === addressKey
                })
                .map(a => a.id)
            
            // Get residents from ALL address records with this address
            const allResidentsForAddress = allResidents.filter(r => sameAddressIds.includes(r.addressId))
            
            // Add consent status to each resident
            const residentsWithConsents = allResidentsForAddress.map(resident => {
                const hasConsentById = allConsents.some(consent => 
                    consent.residentId === resident.id
                )
                
                const hasConsentByName = allConsents.some(consent => 
                    sameAddressIds.includes(consent.addressId) &&
                    consent.signerName && 
                    consent.signerName.toLowerCase().includes(resident.firstName?.toLowerCase()) &&
                    consent.signerName.toLowerCase().includes(resident.lastName?.toLowerCase())
                )
                
                return {
                    ...resident,
                    hasSigned: hasConsentById || hasConsentByName
                }
            })
            
            // Remove duplicate residents and sort
            const uniqueResidents = residentsWithConsents.filter((person, index, self) => {
                return index === self.findIndex(p => 
                    p.firstName === person.firstName && 
                    p.lastName === person.lastName
                )
            })
            
            const residents = uniqueResidents.sort((a, b) => {
                const roleOrder = { 
                    'PRIMARY_OWNER': 1, 
                    'Owner': 1,
                    'SECONDARY_OWNER': 2, 
                    'RENTER': 3, 
                    'OTHER': 4 
                }
                const aRole = a.role || a.occupantType || 'OTHER'
                const bRole = b.role || b.occupantType || 'OTHER'
                const aOrder = roleOrder[aRole] || 5
                const bOrder = roleOrder[bRole] || 5
                
                if (aOrder === bOrder) {
                    const aName = (a.firstName || '').toLowerCase()
                    const bName = (b.firstName || '').toLowerCase()
                    return aName.localeCompare(bName)
                }
                
                return aOrder - bOrder
            })
            
            return {
                ...address,
                residents: residents
                // Preserve any additional properties like isAssigned
            }
        })
    }

    function getUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    })
                },
                () => {}
            )
        }
    }


    function handleAddressClick(address: any) {
        // Toggle selection - if clicking the same address, close the info window
        if (selectedAddress?.id === address.id) {
            setSelectedAddress(null)
        } else {
            setSelectedAddress(address)
        }
    }

    async function handleShowAllToggle(checked: boolean) {
        setToggleLoading(true)
        
        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 100))
        
        setShowAll(checked)
        
        // Wait for map to render new markers
        setTimeout(() => {
            setToggleLoading(false)
        }, 300)
    }

    function openInteractionForm() {
        const params = new URLSearchParams({
            addressId: selectedAddress.id,
            address: `${selectedAddress.street}, ${selectedAddress.city}, ${selectedAddress.state}`
        })
        window.open(`/interact?${params}`, 'canvassingInteractionTab')
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '10px auto', padding: 12}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                    <h2>Canvassing Map</h2>
                    <div style={{display: 'flex', gap: 8}}>
                        <button 
                            onClick={() => {
                                console.log('Manual reload triggered')
                                loadInitialData()
                            }}
                            style={{
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: 'pointer'
                            }}
                        >
                            Reload Data
                        </button>
                    </div>
                    <div>
                        <label style={{display: 'flex', alignItems: 'center', gap: 8, opacity: toggleLoading ? 0.6 : 1}}>
                            <input 
                                type='checkbox' 
                                checked={showAll} 
                                disabled={toggleLoading}
                                onChange={(e) => handleShowAllToggle(e.target.checked)}
                            />
                            Show All Homes (vs My Assignments Only)
                            {toggleLoading && (
                                <span style={{color: '#007bff', fontSize: '12px', marginLeft: '8px'}}>
                                    🔄 Loading...
                                </span>
                            )}
                        </label>
                    </div>
                </div>

                <div style={{marginBottom: 16}}>
                    <p>
                        {dataLoading ? (
                            <span style={{color: '#007bff'}}>
                                🔄 Loading marker data...
                            </span>
                        ) : viewportLoading ? (
                            <span style={{color: '#007bff'}}>
                                🗺️ Loading addresses in view...
                            </span>
                        ) : toggleLoading ? (
                            <span style={{color: '#007bff'}}>
                                🔄 Updating map view...
                            </span>
                        ) : (
                            showAll ? 
                                `Showing ${displayAddresses.length} unique addresses in view (all homes)` : 
                                `Showing ${displayAddresses.length} of your assigned addresses in view`
                        )}
                    </p>
                </div>

                <div style={{position: 'relative'}}>
                    {/* Loading overlay on the map */}
                    {dataLoading && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 1000,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            padding: '20px 40px',
                            borderRadius: 8,
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #007bff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></div>
                            <style>{`
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                            `}</style>
                            <div style={{color: '#333', fontWeight: 'bold'}}>Loading addresses and assignments...</div>
                            <div style={{color: '#666', fontSize: '0.9em'}}>Please wait</div>
                        </div>
                    )}

                <LoadScript 
                    googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''} 
                    onLoad={() => setMapsLoaded(true)}
                >
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={userLocation || center}
                        zoom={12}
                        options={{
                            disableDefaultUI: false,
                            clickableIcons: false,
                            disableDoubleClickZoom: false
                        }}
                        onClick={() => setSelectedAddress(null)}
                        onLoad={(map) => {
                            setMapInstance(map)
                            
                            // Add listeners for viewport changes
                            map.addListener('bounds_changed', debouncedViewportChange)
                            map.addListener('dragend', debouncedViewportChange)
                            map.addListener('zoom_changed', debouncedViewportChange)
                            
                            // Completely disable default InfoWindow
                            const originalAddListener = map.addListener
                            map.addListener = function(eventName, handler) {
                                if (eventName === 'click') {
                                    // Override click to prevent default InfoWindow
                                    return originalAddListener.call(this, eventName, (e) => {
                                        setSelectedAddress(null)
                                        handler(e)
                                    })
                                }
                                return originalAddListener.call(this, eventName, handler)
                            }
                        }}
                    >
                        {userLocation && mapsLoaded && (
                            <Marker
                                position={userLocation}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 8,
                                    fillColor: '#4285f4',
                                    fillOpacity: 1,
                                    strokeWeight: 2,
                                    strokeColor: 'white'
                                }}
                                title="Your Location"
                            />
                        )}

                        {mapsLoaded && displayAddresses.map(address => {
                            return address.lat && address.lng && (
                                <Marker
                                    key={address.id}
                                    position={{lat: address.lat, lng: address.lng}}
                                    onClick={() => handleAddressClick(address)}
                                    icon={{
                                        path: google.maps.SymbolPath.CIRCLE,
                                        scale: 8,
                                        fillColor: address.isAssigned ? '#ff6b6b' : '#4ecdc4',
                                        fillOpacity: 0.8,
                                        strokeWeight: 2,
                                        strokeColor: 'white'
                                    }}
                                />
                            )
                        })}

                        {selectedAddress && selectedAddress.lat && selectedAddress.lng && (
                            <OverlayView
                                position={{lat: selectedAddress.lat, lng: selectedAddress.lng}}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <div style={{
                                    position: 'relative',
                                    backgroundColor: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    minWidth: '250px',
                                    maxWidth: '300px',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                                    transform: 'translate(-50%, -100%)',
                                    marginTop: '-10px',
                                    zIndex: 1000
                                }}>
                                    {/* Close button */}
                                    <button
                                        onClick={() => setSelectedAddress(null)}
                                        style={{
                                            position: 'absolute',
                                            top: '4px',
                                            right: '4px',
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '18px',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            lineHeight: 1
                                        }}
                                    >
                                        ×
                                    </button>
                                    
                                    {/* Content */}
                                    <div style={{paddingRight: '20px'}}>
                                        <h4 style={{margin: '0 0 8px 0', fontSize: '16px'}}>{selectedAddress.street}</h4>
                                        
                                        {/* Show ALL residents and their consent status */}
                                        <div style={{margin: '0 0 12px 0', fontSize: '13px'}}>
                                            {selectedAddress.residents && selectedAddress.residents.length > 0 ? (
                                                selectedAddress.residents.map((resident, index) => {
                                                    // Use occupantType from CSV or role field, map to proper display
                                                    const roleValue = resident.role || resident.occupantType || 'resident'
                                                    const roleDisplay = roleValue.replace('_', ' ').toLowerCase()
                                                    const isAbsentee = resident.isAbsentee === true
                                                    
                                                    
                                                    return (
                                                        <div key={resident.id || index} style={{
                                                            display: 'flex', 
                                                            justifyContent: 'space-between', 
                                                            alignItems: 'center',
                                                            padding: '4px 0',
                                                            borderBottom: index < selectedAddress.residents.length - 1 ? '1px solid #eee' : 'none'
                                                        }}>
                                                            <div style={{flex: 1}}>
                                                                <div style={{color: '#333', fontWeight: 'bold'}}>
                                                                    {resident.firstName && resident.lastName 
                                                                        ? `${resident.firstName} ${resident.lastName}` 
                                                                        : 'Unknown Resident'}
                                                                </div>
                                                                <div style={{color: '#666', fontSize: '11px', marginTop: '1px'}}>
                                                                    {roleDisplay}
                                                                    {isAbsentee && ' (Absentee)'}
                                                                    {resident.externalId && <span style={{color: '#999'}}> • ID: {resident.externalId}</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{marginLeft: '8px'}}>
                                                                <span style={{
                                                                    fontSize: '11px',
                                                                    fontWeight: 'bold',
                                                                    color: resident.hasSigned ? '#28a745' : (isAbsentee ? '#ffc107' : '#dc3545'),
                                                                    backgroundColor: resident.hasSigned ? '#d4edda' : (isAbsentee ? '#fff3cd' : '#f8d7da'),
                                                                    padding: '3px 8px',
                                                                    borderRadius: '4px',
                                                                    border: `1px solid ${resident.hasSigned ? '#28a745' : (isAbsentee ? '#ffc107' : '#dc3545')}`
                                                                }}>
                                                                    {resident.hasSigned ? '✓ SIGNED' : (isAbsentee ? '📮 ABSENTEE' : '✗ NOT SIGNED')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <div style={{color: '#999', fontStyle: 'italic', textAlign: 'center', padding: '8px'}}>
                                                    No resident information available
                                                </div>
                                            )}
                                        </div>
                                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                            <button 
                                                onClick={openInteractionForm}
                                                style={{
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    borderRadius: 4,
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                Record Interaction
                                            </button>
                                            <button 
                                                onClick={() => window.open(`/history?address=${encodeURIComponent(selectedAddress.street)}`, 'canvassingHistoryTab')}
                                                style={{
                                                    backgroundColor: '#6c757d',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 12px',
                                                    borderRadius: 4,
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                View History
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Arrow pointing down to marker */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-8px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 0,
                                        height: 0,
                                        borderLeft: '8px solid transparent',
                                        borderRight: '8px solid transparent',
                                        borderTop: '8px solid white'
                                    }}></div>
                                </div>
                            </OverlayView>
                        )}
                    </GoogleMap>
                </LoadScript>
                </div>

                <div style={{marginTop: 16, fontSize: 14, color: '#666'}}>
                    <p><strong>Legend:</strong></p>
                    <p>🔵 Your current location</p>
                    <p>🔴 Your assigned addresses</p>
                    <p>🔵 Other addresses without consent forms (when "Show All" is enabled)</p>
                    <p>Click on any address marker to record an interaction or view history.</p>
                </div>

            </div>
        </div>
    )
}
