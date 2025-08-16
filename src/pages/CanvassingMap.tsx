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
    const [homes, setHomes] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])
    const [showAll, setShowAll] = useState(false)
    const [selectedHome, setSelectedHome] = useState<any>(null)
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
    const [mapsLoaded, setMapsLoaded] = useState(false)
    const [mapInstance, setMapInstance] = useState(null)
    
    const client = generateClient<Schema>()  // Use authenticated access instead of apiKey

    useEffect(() => {
        console.log('useEffect triggered with user:', user?.userId)
        if (user?.userId) {
            console.log('User authenticated, loading data...')
            loadAssignments() // This now loads both assignments and their homes
            getUserLocation()
        } else {
            console.log('User not authenticated yet, skipping data load')
        }
    }, [user])

    async function loadHomes() {
        console.log('loadHomes: Starting to load homes...')
        try {
            // Load all homes (including absentee owners for now)
            const result = await client.models.Home.list()
            console.log('loadHomes: Raw homes result:', result.data.length)
            console.log('loadHomes: First home sample:', result.data[0])
            if (result.errors) {
                console.error('loadHomes: GraphQL errors:', result.errors)
            }
            // Don't filter out absentee owners yet - let's see all homes
            const allHomes = result.data
            console.log('loadHomes: All homes (including absentee):', allHomes.length)
            setHomes(allHomes)
            console.log('loadHomes: Set homes state to', allHomes.length, 'homes')
        } catch (error) {
            console.error('loadHomes: Failed to load homes:', error)
            console.error('loadHomes: Error details:', error.message, error.stack)
        }
    }

    async function loadAssignments() {
        console.log('🔄 loadAssignments: Starting to load assignments...')
        try {
            // First, get all volunteers to find the current user's volunteer record
            const volunteersResult = await client.models.Volunteer.list()
            console.log('👥 All volunteers:', volunteersResult.data)
            
            // Find the volunteer record for the current user
            const currentUserVolunteer = volunteersResult.data.find(v => 
                v.userSub === user?.userId || v.userSub === user?.username
            )
            console.log('👤 Current user volunteer record:', currentUserVolunteer)
            console.log('🆔 Current user ID:', user?.userId)
            console.log('📧 Current user username:', user?.username)
            
            if (!currentUserVolunteer) {
                console.log('loadAssignments: No volunteer record found for current user')
                setAssignments([])
                setHomes([])
                return
            }
            
            // Get assignments for this volunteer
            console.log('loadAssignments: Looking for assignments with volunteerId:', currentUserVolunteer.id)
            const assignmentsResult = await client.models.Assignment.list({
                filter: { volunteerId: { eq: currentUserVolunteer.id } }
            })
            console.log('User assignments:', assignmentsResult.data)
            
            const activeAssignments = assignmentsResult.data.filter(a => a.status === 'NOT_STARTED')
            console.log('Active assignments:', activeAssignments)
            
            // Now get the actual homes for these assignments
            if (activeAssignments.length > 0) {
                console.log('Loading homes for assignments...')
                const homeIds = activeAssignments.map(a => a.homeId)
                
                // Load homes that match the assignments
                const homesPromises = homeIds.map(async (homeId) => {
                    try {
                        const homeResult = await client.models.Home.get({ id: homeId })
                        if (homeResult.data) {
                            console.log('Found home:', homeResult.data.street, homeResult.data.city)
                            return homeResult.data
                        }
                    } catch (error) {
                        console.error(`Failed to load home ${homeId}:`, error)
                    }
                    return null
                })
                
                const assignedHomes = await Promise.all(homesPromises)
                const validHomes = assignedHomes.filter(h => h !== null)
                
                console.log('loadAssignments: Found', validHomes.length, 'homes for', activeAssignments.length, 'assignments')
                setHomes(validHomes)
                setAssignments(activeAssignments)
            } else {
                console.log('No active assignments found')
                setHomes([])
                setAssignments([])
            }
            
        } catch (error) {
            console.error('loadAssignments: Failed to load assignments:', error)
            console.error('loadAssignments: Error details:', error.message, error.stack)
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
                (error) => console.log('Geolocation error:', error)
            )
        }
    }

    async function geocodeHomes() {
        // Check if Google Maps is loaded
        if (!window.google || !window.google.maps) {
            alert('Google Maps not loaded yet. Please wait a moment and try again.')
            return
        }

        // Get ALL homes (assigned ones) to geocode
        const homesToGeocode = homes
        if (homesToGeocode.length === 0) {
            alert('No homes to geocode!')
            return
        }

        const confirmed = confirm(`This will geocode ALL ${homesToGeocode.length} homes using Google's API (including ones that already have coordinates). This may take several minutes. Continue?`)
        if (!confirmed) return

        console.log(`Geocoding ALL ${homesToGeocode.length} homes using Google Geocoding API...`)
        const geocoder = new window.google.maps.Geocoder()
        
        let successCount = 0
        let errorCount = 0
        let skippedCount = 0
        
        for (let i = 0; i < homesToGeocode.length; i++) {
            const home = homesToGeocode[i]
            const address = `${home.street}, ${home.city}, ${home.state || 'VA'} ${home.postalCode || ''}`
            
            try {
                console.log(`Geocoding ${i + 1}/${homesToGeocode.length}: ${address}`)
                
                // Use Google Maps JavaScript API Geocoder
                const geocodePromise = new Promise((resolve, reject) => {
                    geocoder.geocode({ 
                        address: address,
                        componentRestrictions: {
                            country: 'US',
                            administrativeArea: home.state || 'VA'
                        }
                    }, (results, status) => {
                        if (status === 'OK' && results && results.length > 0) {
                            resolve(results[0])
                        } else {
                            reject(new Error(`Geocoding failed: ${status}`))
                        }
                    })
                })
                
                const result = await geocodePromise
                const location = result.geometry.location
                const lat = location.lat()
                const lng = location.lng()
                
                console.log(`✅ Found coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                
                // Update the home in the database
                await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                })
                
                // Update local state immediately
                setHomes(prevHomes => 
                    prevHomes.map(h => 
                        h.id === home.id 
                            ? { ...h, lat: lat, lng: lng }
                            : h
                    )
                )
                
                successCount++
                console.log(`✅ Updated ${home.street} with real coordinates`)
                
                // Add a delay to respect API rate limits
                await new Promise(resolve => setTimeout(resolve, 200))
                
            } catch (error) {
                errorCount++
                console.error(`❌ Error geocoding ${address}:`, error.message)
                
                // Add delay even on errors to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, 500))
            }
        }
        
        console.log(`🎉 Geocoding complete! Successfully geocoded ${successCount} homes, ${errorCount} failed.`)
        alert(`Geocoding complete! Successfully geocoded ${successCount} out of ${homesToGeocode.length} homes. Refresh the page to see all markers.`)
    }

    const displayHomes = useMemo(() => {
        let filteredHomes = showAll ? homes : homes.filter(h => 
            assignments.some(a => a.homeId === h.id)
        )
        
        // Remove duplicates by home ID to prevent multiple markers at same location
        const uniqueHomes = filteredHomes.filter((home, index, array) => 
            array.findIndex(h => h.id === home.id) === index
        )
        
        console.log('🏠 displayHomes stats:', {
            total: filteredHomes.length,
            unique: uniqueHomes.length,
            duplicatesRemoved: filteredHomes.length - uniqueHomes.length
        })
        
        return uniqueHomes
    }, [showAll, homes, assignments])

    function handleHomeClick(home: any) {
        console.log('🖱️ Marker clicked:', home.street, 'id:', home.id)
        console.log('🖱️ Currently selected:', selectedHome?.street, 'id:', selectedHome?.id)
        
        // Toggle selection - if clicking the same home, close the info window
        if (selectedHome?.id === home.id) {
            console.log('🖱️ Closing info window (same home clicked)')
            setSelectedHome(null)
        } else {
            console.log('🖱️ Opening info window for new home')
            setSelectedHome(home)
        }
    }

    function openInteractionForm() {
        const params = new URLSearchParams({
            homeId: selectedHome.id,
            address: `${selectedHome.street}, ${selectedHome.city}, ${selectedHome.state}`
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
                        <button 
                            onClick={geocodeHomes}
                            style={{
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: 4,
                                cursor: 'pointer'
                            }}
                        >
                            Geocode All Homes
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
                            `Showing ${displayHomes.length} homes without signed consents` : 
                            `Showing ${displayHomes.length} of your assigned homes`
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
                        zoom={15}
                        options={{
                            disableDefaultUI: false,
                            clickableIcons: false,
                            disableDoubleClickZoom: false
                        }}
                        onClick={() => {
                            console.log('🗺️ Map clicked - closing InfoWindows')
                            setSelectedHome(null)
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
                                        setSelectedHome(null)
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

                        {mapsLoaded && displayHomes.map(home => {
                            console.log('🎯 Rendering marker for:', home.street, 'lat:', home.lat, 'lng:', home.lng, 'hasCoords:', !!(home.lat && home.lng))
                            return home.lat && home.lng && (
                                <Marker
                                    key={home.id}
                                    position={{lat: home.lat, lng: home.lng}}
                                    onClick={() => {
                                        console.log('🖱️ Marker clicked:', home.street)
                                        handleHomeClick(home)
                                    }}
                                    icon={{
                                        path: google.maps.SymbolPath.CIRCLE,
                                        scale: 8,
                                        fillColor: assignments.some(a => a.homeId === home.id) ? '#ff6b6b' : '#4ecdc4',
                                        fillOpacity: 0.8,
                                        strokeWeight: 2,
                                        strokeColor: 'white'
                                    }}
                                />
                            )
                        })}

                        {selectedHome && selectedHome.lat && selectedHome.lng && (
                            <OverlayView
                                position={{lat: selectedHome.lat, lng: selectedHome.lng}}
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
                                            setSelectedHome(null)
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
                                        <h4 style={{margin: '0 0 8px 0', fontSize: '16px'}}>{selectedHome.street}</h4>
                                        <p style={{margin: '0 0 12px 0', color: '#666', fontSize: '14px'}}>
                                            {selectedHome.city}, {selectedHome.state}
                                        </p>
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
                                                onClick={() => window.open(`/history?address=${encodeURIComponent(selectedHome.street)}`, '_blank')}
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
                    <p>🔴 Your assigned homes</p>
                    <p>🔵 Other homes without consent forms (when "Show All" is enabled)</p>
                    <p>Click on any home marker to record an interaction or view history.</p>
                </div>

            </div>
        </div>
    )
}
