import Header from '../components/Header'
import {useEffect, useState, useMemo, useCallback} from 'react'
import {GoogleMap, LoadScript, Marker, OverlayView} from '@react-google-maps/api'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {useAuthenticator} from '@aws-amplify/ui-react'

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
    const [addresses, setAddresses] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])
    const [showAll, setShowAll] = useState(false)
    const [selectedAddress, setSelectedAddress] = useState<any>(null)
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
    const [mapsLoaded, setMapsLoaded] = useState(false)
    const [mapInstance, setMapInstance] = useState(null)
    
    const client = generateClient<Schema>()  // Use authenticated access instead of apiKey

    // Calculate which addresses to display based on filters
    const displayAddresses = useMemo(() => {
        let filteredAddresses = showAll ? addresses : addresses.filter(h => 
            assignments.some(a => a.addressId === h.id)
        )
        
        // Remove duplicates by address ID to prevent multiple markers at same location
        const uniqueAddresses = filteredAddresses.filter((address, index, array) => 
            array.findIndex(h => h.id === address.id) === index
        )
        
        
        return uniqueAddresses
    }, [showAll, addresses, assignments])

    useEffect(() => {
        if (user?.userId) {
            loadAssignments() // This now loads both assignments and their addresses
            getUserLocation()
        }
    }, [user])

    // Auto-fit map bounds to show all markers
    useEffect(() => {
        if (mapInstance && mapsLoaded && displayAddresses.length > 0) {
            
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
                
                // Add a listener to prevent over-zooming on single markers
                const listener = google.maps.event.addListenerOnce(mapInstance, 'bounds_changed', () => {
                    const currentZoom = mapInstance.getZoom()
                    if (currentZoom && currentZoom > 18) {
                        mapInstance.setZoom(18) // Max zoom level to prevent too close zoom
                    }
                })
                
            }
        }
    }, [mapInstance, mapsLoaded, displayAddresses, userLocation])


    async function loadAssignments() {
        try {
            // Step 1: Load ALL residents first (same as Organize page)
            let allResidents: any[] = []
            let residentsNextToken = null
            
            do {
                const residentsResult = await client.models.Resident.list({ 
                    limit: 1000,
                    nextToken: residentsNextToken
                })
                allResidents.push(...residentsResult.data)
                residentsNextToken = residentsResult.nextToken
            } while (residentsNextToken)
            
            
            // Step 2: Get all volunteers to find the current user's volunteer record
            const volunteersResult = await client.models.Volunteer.list()
            
            // Find the volunteer record for the current user
            const currentUserVolunteer = volunteersResult.data.find(v => 
                v.userSub === user?.userId || v.userSub === user?.username
            )
            
            if (!currentUserVolunteer) {
                console.log('❌ No volunteer record found for current user')
                setAssignments([])
                setAddresses([])
                return
            }
            
            // Step 3: Get assignments for this volunteer
            const assignmentsResult = await client.models.Assignment.list({
                filter: { volunteerId: { eq: currentUserVolunteer.id } }
            })
            
            const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED')
            
            // Step 4: Load addresses for assignments (same pattern as Organize page)
            if (activeAssignments.length > 0) {
                const addressIds = activeAssignments.map(a => a.addressId)
                
                const addressesWithDetailsPromises = addressIds.map(async (addressId) => {
                    try {
                        const addressResult = await client.models.Address.get({ id: addressId })
                        if (addressResult.data) {
                            const address = addressResult.data
                            
                            // Get residents for this address from pre-loaded list (Organize page approach)
                            const allResidentsForAddress = allResidents.filter(p => p.addressId === addressId)
                            console.log(`🔍 Address ${address.street}: Found ${allResidentsForAddress.length} total residents for addressId ${addressId}`)
                            if (address.street && address.street.includes('Cloverleaf')) {
                                console.log(`🌿 CLOVERLEAF DEBUG: Address details:`, address)
                                console.log(`🌿 CLOVERLEAF DEBUG: All residents for this address:`, allResidentsForAddress)
                                console.log(`🌿 CLOVERLEAF DEBUG: Total residents loaded:`, allResidents.length)
                                console.log(`🌿 CLOVERLEAF DEBUG: Sample resident addressIds:`, allResidents.slice(0, 5).map(r => ({ addressId: r.addressId, name: `${r.firstName} ${r.lastName}` })))
                            }
                            
                            // Remove duplicate residents (same name at same address) - copied from Organize page
                            const uniqueResidents = allResidentsForAddress.filter((person, index, self) => {
                                return index === self.findIndex(p => 
                                    p.firstName === person.firstName && 
                                    p.lastName === person.lastName
                                )
                            })
                            
                            // Sort residents (PRIMARY_OWNER first) - same as Organize page
                            const residents = uniqueResidents.sort((a, b) => {
                                const roleOrder = { 'PRIMARY_OWNER': 1, 'SECONDARY_OWNER': 2, 'RENTER': 3, 'OTHER': 4 }
                                const aOrder = roleOrder[a.role] || 5
                                const bOrder = roleOrder[b.role] || 5
                                return aOrder - bOrder
                            })
                            
                            if (allResidentsForAddress.length !== residents.length) {
                                console.log(`🧹 ${address.street}: Removed ${allResidentsForAddress.length - residents.length} duplicate residents`)
                            }
                            
                            console.log(`🏠 ${address.street}: ${residents.length} unique residents`)
                            if (residents.length > 0) {
                                residents.forEach(r => {
                                    console.log(`   👤 ${r.firstName} ${r.lastName} (${r.role})`)
                                })
                            }
                            
                            const result = {
                                ...address,
                                residents: residents
                            }
                            if (address.street && address.street.includes('Cloverleaf')) {
                                console.log(`🌿 CLOVERLEAF FINAL: Final address object:`, result)
                            }
                            return result
                        }
                    } catch (error) {
                        console.error(`❌ Failed to load address ${addressId}:`, error)
                    }
                    return null
                })
                
                const allAddressesWithDetails = await Promise.all(addressesWithDetailsPromises)
                const validAddresses = allAddressesWithDetails.filter(address => address !== null)
                
                console.log(`✅ Successfully loaded ${validAddresses.length} addresses with resident data`)
                setAddresses(validAddresses)
                setAssignments(activeAssignments)
            } else {
                console.log('❌ No active assignments found')
                setAddresses([])
                setAssignments([])
            }
            
        } catch (error) {
            console.error('💥 Failed to load assignments:', error)
        }
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

    function openInteractionForm() {
        const params = new URLSearchParams({
            addressId: selectedAddress.id,
            address: `${selectedAddress.street}, ${selectedAddress.city}, ${selectedAddress.state}`
        })
        window.open(`/interact?${params}`, '_blank')
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
                                loadAssignments()
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
                        <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            <input 
                                type='checkbox' 
                                checked={showAll} 
                                onChange={(e) => setShowAll(e.target.checked)}
                            />
                            Show All Homes (vs My Assignments Only)
                        </label>
                    </div>
                </div>

                <div style={{marginBottom: 16}}>
                    <p>
                        {showAll ? 
                            `Showing ${displayAddresses.length} addresses without signed consents` : 
                            `Showing ${displayAddresses.length} of your assigned addresses`
                        }
                    </p>
                </div>

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
                        onClick={() => {
                            console.log('🗺️ Map clicked - closing InfoWindows')
                            setSelectedAddress(null)
                        }}
                        onLoad={(map) => {
                            console.log('🗺️ Map loaded, disabling default InfoWindow')
                            setMapInstance(map)
                            
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
                                        fillColor: assignments.some(a => a.addressId === address.id) ? '#ff6b6b' : '#4ecdc4',
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
                                        onClick={() => {
                                            console.log('🖱️ Custom overlay close clicked')
                                            setSelectedAddress(null)
                                        }}
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
                                                    // Determine if this person can sign (owners vs renters)
                                                    const isOwner = resident.role === 'PRIMARY_OWNER' || resident.role === 'SECONDARY_OWNER'
                                                    const roleDisplay = resident.role ? resident.role.replace('_', ' ').toLowerCase() : 'resident'
                                                    
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
                                                                    {!isOwner && ' (cannot sign)'}
                                                                </div>
                                                            </div>
                                                            <div style={{marginLeft: '8px'}}>
                                                                {isOwner ? (
                                                                    <span style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: 'bold',
                                                                        color: resident.hasSigned ? '#28a745' : '#dc3545',
                                                                        backgroundColor: resident.hasSigned ? '#d4edda' : '#f8d7da',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '4px',
                                                                        border: `1px solid ${resident.hasSigned ? '#28a745' : '#dc3545'}`
                                                                    }}>
                                                                        {resident.hasSigned ? '✓ SIGNED' : '✗ NOT SIGNED'}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{
                                                                        fontSize: '11px',
                                                                        color: '#6c757d',
                                                                        backgroundColor: '#f8f9fa',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #dee2e6'
                                                                    }}>
                                                                        N/A
                                                                    </span>
                                                                )}
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
                                                onClick={() => window.open(`/history?address=${encodeURIComponent(selectedAddress.street)}`, '_blank')}
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
