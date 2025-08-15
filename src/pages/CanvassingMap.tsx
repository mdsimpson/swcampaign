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
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    useEffect(() => {
        loadHomes()
        loadAssignments()
        getUserLocation()
    }, [user])

    async function loadHomes() {
        try {
            const result = await client.models.Home.list()
            const homesWithoutConsents = result.data.filter(h => !h.absenteeOwner)
            setHomes(homesWithoutConsents)
        } catch (error) {
            console.error('Failed to load homes:', error)
        }
    }

    async function loadAssignments() {
        try {
            const result = await client.models.Assignment.list()
            const userAssignments = result.data.filter(a => 
                a.volunteer?.userSub === user?.userId && 
                a.status === 'NOT_STARTED'
            )
            setAssignments(userAssignments)
        } catch (error) {
            console.error('Failed to load assignments:', error)
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

                <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={userLocation || center}
                        zoom={15}
                    >
                        {userLocation && (
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

                        {displayHomes.map(home => home.lat && home.lng && (
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
