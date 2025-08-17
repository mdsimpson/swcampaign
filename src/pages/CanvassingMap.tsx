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
            // Step 1: Load ALL addresses, residents, and consents first
            let allAddresses: any[] = []
            let addressesNextToken = null
            
            do {
                const addressesResult = await client.models.Address.list({ 
                    limit: 1000,
                    nextToken: addressesNextToken
                })
                allAddresses.push(...addressesResult.data)
                addressesNextToken = addressesResult.nextToken
            } while (addressesNextToken)
            
            console.log(`📍 Loaded ${allAddresses.length} total addresses`)
            
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
            
            console.log(`👥 Loaded ${allResidents.length} total residents`)
            
            // Load all consent records to determine who has signed
            let allConsents: any[] = []
            let consentsNextToken = null
            
            do {
                const consentsResult = await client.models.Consent.list({ 
                    limit: 1000,
                    nextToken: consentsNextToken
                })
                allConsents.push(...consentsResult.data)
                consentsNextToken = consentsResult.nextToken
            } while (consentsNextToken)
            
            console.log(`📝 Loaded ${allConsents.length} total consent records`)
            
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
            
            // Step 4: Load addresses for assignments with duplicate handling (EXACTLY like Organize page)
            if (activeAssignments.length > 0) {
                const addressIds = activeAssignments.map(a => a.addressId)
                
                const addressesWithDetailsPromises = addressIds.map(async (addressId) => {
                    try {
                        const addressResult = await client.models.Address.get({ id: addressId })
                        if (addressResult.data) {
                            const address = addressResult.data
                            const addressKey = `${address.street?.toLowerCase().trim()}, ${address.city?.toLowerCase().trim()}`
                            
                            // Find ALL address IDs with the same street address (handling duplicates)
                            const sameAddressIds = allAddresses
                                .filter(a => {
                                    const aAddress = `${a.street?.toLowerCase().trim()}, ${a.city?.toLowerCase().trim()}`
                                    return aAddress === addressKey
                                })
                                .map(a => a.id)
                            
                            if (sameAddressIds.length > 1) {
                                console.log(`🔄 Found ${sameAddressIds.length} duplicate address records for ${address.street}`)
                            }
                            
                            // Get residents from ALL address records with this address
                            const allResidentsForAddress = allResidents.filter(r => sameAddressIds.includes(r.addressId))
                            
                            // Add consent status to each resident
                            const residentsWithConsents = allResidentsForAddress.map(resident => {
                                // Check if this resident has signed by looking for consent records
                                // Match by resident ID or by name and address combination
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
                            
                            console.log(`🔍 Address ${address.street}: Found ${residentsWithConsents.length} total residents across ${sameAddressIds.length} address records`)
                            
                            if (address.street && address.street.includes('Cloverleaf')) {
                                console.log(`🌿 CLOVERLEAF DEBUG: Address details:`, address)
                                console.log(`🌿 CLOVERLEAF DEBUG: Duplicate address IDs:`, sameAddressIds)
                                console.log(`🌿 CLOVERLEAF DEBUG: All residents for this address:`, residentsWithConsents)
                                console.log(`🌿 CLOVERLEAF DEBUG: Consent records for these addresses:`, allConsents.filter(c => sameAddressIds.includes(c.addressId)))
                            }
                            
                            // Remove duplicate residents (same name at same address) - copied from Organize page
                            const uniqueResidents = residentsWithConsents.filter((person, index, self) => {
                                return index === self.findIndex(p => 
                                    p.firstName === person.firstName && 
                                    p.lastName === person.lastName
                                )
                            })
                            
                            // Sort residents (PRIMARY_OWNER first, then SECONDARY_OWNER, then others)
                            const residents = uniqueResidents.sort((a, b) => {
                                const roleOrder = { 
                                    'PRIMARY_OWNER': 1, 
                                    'Owner': 1,  // CSV uses "Owner" for primary owners
                                    'SECONDARY_OWNER': 2, 
                                    'RENTER': 3, 
                                    'OTHER': 4 
                                }
                                const aRole = a.role || a.occupantType || 'OTHER'
                                const bRole = b.role || b.occupantType || 'OTHER'
                                const aOrder = roleOrder[aRole] || 5
                                const bOrder = roleOrder[bRole] || 5
                                
                                // If same role priority, sort alphabetically by first name
                                if (aOrder === bOrder) {
                                    const aName = (a.firstName || '').toLowerCase()
                                    const bName = (b.firstName || '').toLowerCase()
                                    return aName.localeCompare(bName)
                                }
                                
                                return aOrder - bOrder
                            })
                            
                            if (residentsWithConsents.length !== residents.length) {
                                console.log(`🧹 ${address.street}: Removed ${residentsWithConsents.length - residents.length} duplicate residents`)
                            }
                            
                            console.log(`🏠 ${address.street}: ${residents.length} unique residents`)
                            if (residents.length > 0) {
                                residents.forEach(r => {
                                    const displayRole = r.role || r.occupantType || 'Unknown'
                                    console.log(`   👤 ${r.firstName} ${r.lastName} (${displayRole})`)
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
                                                    // Use occupantType from CSV or role field, map to proper display
                                                    const roleValue = resident.role || resident.occupantType || 'resident'
                                                    const roleDisplay = roleValue.replace('_', ' ').toLowerCase()
                                                    const isAbsentee = resident.isAbsentee === true
                                                    
                                                    // Debug logging for role detection
                                                    if (selectedAddress.street && selectedAddress.street.includes('Cloverleaf')) {
                                                        console.log(`🎯 POPUP DEBUG: ${resident.firstName} ${resident.lastName} - roleValue: "${roleValue}", isAbsentee: ${isAbsentee}, hasSigned: ${resident.hasSigned}`)
                                                    }
                                                    
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
