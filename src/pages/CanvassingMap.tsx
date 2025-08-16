import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {GoogleMap, LoadScript, Marker, InfoWindow} from '@react-google-maps/api'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {useAuthenticator} from '@aws-amplify/ui-react'

const mapContainerStyle = {
    width: '100%',
    height: '70vh'
}

const center = {
    lat: 38.9637,
    lng: -77.3967 // Broadlands, VA
}

export default function CanvassingMap() {
    const {user} = useAuthenticator(ctx => [ctx.user])
    const [homes, setHomes] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])
    const [showAll, setShowAll] = useState(false)
    const [selectedHome, setSelectedHome] = useState<any>(null)
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
    const [mapsLoaded, setMapsLoaded] = useState(false)
    
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
        console.log('loadAssignments: Starting to load assignments...')
        try {
            // First, get all volunteers to find the current user's volunteer record
            const volunteersResult = await client.models.Volunteer.list()
            console.log('All volunteers:', volunteersResult.data)
            
            // Find the volunteer record for the current user
            const currentUserVolunteer = volunteersResult.data.find(v => 
                v.userSub === user?.userId || v.userSub === user?.username
            )
            console.log('Current user volunteer record:', currentUserVolunteer)
            console.log('Current user ID:', user?.userId)
            console.log('Current user username:', user?.username)
            
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

        const homesWithoutCoords = homes.filter(h => !h.lat || !h.lng)
        if (homesWithoutCoords.length === 0) {
            alert('All homes already have coordinates!')
            return
        }

        console.log(`Geocoding ${homesWithoutCoords.length} homes using Google Maps JavaScript API...`)
        const geocoder = new window.google.maps.Geocoder()
        
        for (let i = 0; i < homesWithoutCoords.length; i++) {
            const home = homesWithoutCoords[i]
            const address = `${home.street}, ${home.city}, ${home.state || 'VA'} ${home.postalCode || ''}`
            
            try {
                console.log(`Geocoding ${i + 1}/${homesWithoutCoords.length}: ${address}`)
                
                // Use Google Maps JavaScript API Geocoder
                const geocodePromise = new Promise((resolve, reject) => {
                    geocoder.geocode({ address: address }, (results, status) => {
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
                
                console.log(`Found coordinates: ${lat}, ${lng}`)
                
                // Update the home in the database
                await client.models.Home.update({
                    id: home.id,
                    lat: lat,
                    lng: lng
                })
                
                // Update local state
                setHomes(prevHomes => 
                    prevHomes.map(h => 
                        h.id === home.id 
                            ? { ...h, lat: lat, lng: lng }
                            : h
                    )
                )
                
                console.log(`Updated home ${home.id} with coordinates`)
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 300))
                
            } catch (error) {
                console.error(`Error geocoding ${address}:`, error)
            }
        }
        
        console.log('Geocoding complete!')
        alert('Geocoding complete! The homes should now appear on the map.')
    }

    const displayHomes = showAll ? homes : homes.filter(h => 
        assignments.some(a => a.homeId === h.id)
    )

    function handleHomeClick(home: any) {
        setSelectedHome(home)
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

                        {mapsLoaded && displayHomes.map(home => home.lat && home.lng && (
                            <Marker
                                key={home.id}
                                position={{lat: home.lat, lng: home.lng}}
                                onClick={() => handleHomeClick(home)}
                                icon={{
                                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                                    scale: 6,
                                    fillColor: assignments.some(a => a.homeId === home.id) ? '#ff6b6b' : '#4ecdc4',
                                    fillOpacity: 0.8,
                                    strokeWeight: 2,
                                    strokeColor: 'white'
                                }}
                            />
                        ))}

                        {selectedHome && (
                            <InfoWindow
                                position={{lat: selectedHome.lat, lng: selectedHome.lng}}
                                onCloseClick={() => setSelectedHome(null)}
                            >
                                <div style={{padding: 8}}>
                                    <h4>{selectedHome.street}</h4>
                                    <p>{selectedHome.city}, {selectedHome.state}</p>
                                    <div style={{marginTop: 8}}>
                                        <button 
                                            onClick={openInteractionForm}
                                            style={{
                                                backgroundColor: '#007bff',
                                                color: 'white',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                marginRight: 8
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
                                                padding: '8px 16px',
                                                borderRadius: 4,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            View History
                                        </button>
                                    </div>
                                </div>
                            </InfoWindow>
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
