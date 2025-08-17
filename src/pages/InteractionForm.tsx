import Header from '../components/Header'
import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import { useAuthenticator } from '@aws-amplify/ui-react'
import { QUERY_LIMITS, loadAllRecords } from '../config/queries'

export default function InteractionForm() {
    const { user } = useAuthenticator(ctx => [ctx.user])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [addressId, setAddressId] = useState('')
    const [addressDisplay, setAddressDisplay] = useState('')
    const [residents, setResidents] = useState<any[]>([])
    
    // Form state
    const [selectedResidents, setSelectedResidents] = useState<string[]>([])
    const [spokeToHomeowner, setSpokeToHomeowner] = useState(false)
    const [spokeToOther, setSpokeToOther] = useState(false)
    const [otherPersonName, setOtherPersonName] = useState('')
    const [leftFlyer, setLeftFlyer] = useState(false)
    const [notes, setNotes] = useState('')
    const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null)
    
    const client = generateClient<Schema>({
        authMode: 'apiKey' // Use API key access to see all residents data
    })

    useEffect(() => {
        // Get URL parameters
        const params = new URLSearchParams(window.location.search)
        const paramAddressId = params.get('addressId')
        const paramAddress = params.get('address')
        
        if (paramAddressId && paramAddress) {
            setAddressId(paramAddressId)
            setAddressDisplay(paramAddress)
            loadResidents(paramAddressId)
        } else {
            console.error('Missing required URL parameters: addressId and address')
            setLoading(false)
        }
        
        // Get current location
        getCurrentLocation()
    }, [])

    async function loadResidents(addressId: string) {
        try {
            // Load ALL residents and addresses using centralized pagination config
            const [allResidents, allAddresses] = await Promise.all([
                loadAllRecords(
                    (config) => client.models.Resident.list(config),
                    QUERY_LIMITS.RESIDENTS_BATCH_SIZE
                ),
                loadAllRecords(
                    (config) => client.models.Address.list(config),
                    QUERY_LIMITS.ADDRESSES_BATCH_SIZE
                )
            ])
            
            const allResidentsResult = { data: allResidents }
            const allAddressesResult = { data: allAddresses }
            
            // Find the target address
            const targetAddress = allAddressesResult.data.find(a => a.id === addressId)
            if (!targetAddress) {
                console.error('Address not found for ID:', addressId)
                setLoading(false)
                return
            }
            
            console.log('🏠 Target address found:', targetAddress.street, targetAddress.city)
            console.log('🏠 Target address ID:', targetAddress.id)
            
            // Find all addresses with same street address (handle duplicates)
            const addressKey = `${targetAddress.street?.toLowerCase().trim()}, ${targetAddress.city?.toLowerCase().trim()}`
            console.log('🔍 INTERACTION FORM DEBUG: Generated address key:', addressKey)
            
            const sameAddressIds = allAddressesResult.data
                .filter(a => {
                    const aAddress = `${a.street?.toLowerCase().trim()}, ${a.city?.toLowerCase().trim()}`
                    return aAddress === addressKey
                })
                .map(a => a.id)
            
            console.log(`📍 Found ${sameAddressIds.length} address records with same street address:`, addressKey)
            console.log('📍 Address IDs:', sameAddressIds)
            
            // Get residents from all address records with this address
            const allResidentsForAddress = allResidentsResult.data.filter(r => sameAddressIds.includes(r.addressId))
            console.log(`👥 Found ${allResidentsForAddress.length} residents total across all duplicate addresses`)
            
            // Debug: show each resident found
            allResidentsForAddress.forEach(r => {
                console.log(`   👤 BEFORE DEDUP: ${r.firstName} ${r.lastName} (addressId: ${r.addressId})`)
            })
            
            // Debug: Let's see what residents exist for ANY Cloverleaf address
            const allCloverleafResidents = allResidentsResult.data.filter(r => {
                const residentAddress = allAddressesResult.data.find(a => a.id === r.addressId)
                return residentAddress && residentAddress.street && residentAddress.street.toLowerCase().includes('cloverleaf')
            })
            console.log(`🔍 DEBUG: Found ${allCloverleafResidents.length} residents for ANY Cloverleaf address in database`)
            
            // Show all Cloverleaf residents to see address formats
            if (allCloverleafResidents.length > 0) {
                console.log('🔍 DEBUG: All Cloverleaf residents in database:')
                allCloverleafResidents.forEach(r => {
                    const addr = allAddressesResult.data.find(a => a.id === r.addressId)
                    console.log(`   👤 ${r.firstName} ${r.lastName} → "${addr?.street}", "${addr?.city}" (ID: ${r.addressId})`)
                })
            }
            
            // Also debug: what address formats exist for 42927?
            const all42927Addresses = allAddressesResult.data.filter(a => 
                a.street && a.street.toLowerCase().includes('42927')
            )
            console.log(`🔍 DEBUG: All address records containing "42927":`)
            all42927Addresses.forEach(addr => {
                console.log(`   🏠 "${addr.street}", "${addr.city}" (ID: ${addr.id})`)
            })
            
            // Remove duplicate residents (same name)
            const uniqueResidents = allResidentsForAddress.filter((person, index, self) => {
                return index === self.findIndex(p => 
                    p.firstName === person.firstName && 
                    p.lastName === person.lastName
                )
            })
            
            // Sort residents (owners first)
            const sortedResidents = uniqueResidents.sort((a, b) => {
                const roleOrder = { 
                    'PRIMARY_OWNER': 1, 
                    'Owner': 1,
                    'SECONDARY_OWNER': 2, 
                    'Official Owner': 1,
                    'Official Co Owner': 2,
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
            
            console.log(`✅ Final result: ${sortedResidents.length} unique residents for interaction form`)
            sortedResidents.forEach(r => {
                console.log(`   👤 FINAL: ${r.firstName} ${r.lastName} (${r.role || r.occupantType || 'Unknown'})`)
            })
            
            setResidents(sortedResidents)
            
        } catch (error) {
            console.error('Failed to load residents:', error)
        } finally {
            setLoading(false)
        }
    }

    function getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCurrentLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    })
                },
                (error) => {
                    console.log('Could not get location:', error.message)
                }
            )
        }
    }

    function handleResidentSelection(residentId: string, checked: boolean) {
        if (checked) {
            setSelectedResidents([...selectedResidents, residentId])
        } else {
            setSelectedResidents(selectedResidents.filter(id => id !== residentId))
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        
        if (!spokeToHomeowner && !spokeToOther && !leftFlyer) {
            alert('Please select at least one interaction type (spoke to homeowner, spoke to other, or left flyer)')
            return
        }
        
        if (spokeToOther && !otherPersonName.trim()) {
            alert('Please enter the name of the other person you spoke to')
            return
        }
        
        setSaving(true)
        
        try {
            // Build participant resident IDs string
            let participantIds = selectedResidents.join(',')
            if (spokeToOther && otherPersonName.trim()) {
                participantIds += (participantIds ? ',' : '') + otherPersonName.trim()
            }
            
            const interactionData = {
                addressId: addressId,
                participantResidentIds: participantIds || '',
                spokeToHomeowner: spokeToHomeowner,
                spokeToOther: spokeToOther,
                leftFlyer: leftFlyer,
                notes: notes.trim() || undefined,
                lat: currentLocation?.lat,
                lng: currentLocation?.lng,
                createdAt: new Date().toISOString(),
                createdBy: user?.userId || user?.username || 'unknown'
            }
            
            console.log('Creating interaction record with data:', interactionData)
            console.log('User info:', { userId: user?.userId, username: user?.username, signInDetails: user?.signInDetails })
            
            const result = await client.models.InteractionRecord.create(interactionData)
            
            console.log('Interaction record created successfully:', result)
            
            if (result.data?.id) {
                alert('Interaction recorded successfully! Record ID: ' + result.data.id)
            } else {
                console.warn('Record created but no ID returned:', result)
                alert('Interaction may have been recorded, but confirmation is unclear.')
            }
            
            // Reset form
            setSelectedResidents([])
            setSpokeToHomeowner(false)
            setSpokeToOther(false)
            setOtherPersonName('')
            setLeftFlyer(false)
            setNotes('')
            
        } catch (error) {
            console.error('Failed to record interaction - Full error:', error)
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                errors: error.errors
            })
            alert('Failed to record interaction: ' + error.message + '\nCheck console for details.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 700, margin: '20px auto', padding: 20}}>
                    <h2>Record Canvassing Interaction</h2>
                    <p>Loading address information...</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 700, margin: '20px auto', padding: 20}}>
                <h2>Record Canvassing Interaction</h2>
                <div style={{marginBottom: 20, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8}}>
                    <strong>Address:</strong> {addressDisplay}
                    {currentLocation && (
                        <div style={{marginTop: 8, fontSize: '0.9em', color: '#666'}}>
                            📍 Location: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Residents Section */}
                    {residents.length > 0 && (
                        <div style={{marginBottom: 24}}>
                            <h3>Residents at this Address</h3>
                            <p style={{color: '#666', fontSize: '0.9em', marginBottom: 12}}>
                                Select residents you interacted with:
                            </p>
                            {residents.map(resident => {
                                const roleValue = resident.role || resident.occupantType || 'resident'
                                const roleDisplay = roleValue.replace('_', ' ').toLowerCase()
                                const isAbsentee = resident.isAbsentee === true
                                
                                return (
                                    <label key={resident.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        marginBottom: 8,
                                        backgroundColor: '#f8f9fa',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedResidents.includes(resident.id)}
                                            onChange={(e) => handleResidentSelection(resident.id, e.target.checked)}
                                            style={{marginRight: 12}}
                                        />
                                        <div style={{flex: 1}}>
                                            <div style={{fontWeight: 'bold'}}>
                                                {resident.firstName} {resident.lastName}
                                            </div>
                                            <div style={{fontSize: '0.9em', color: '#666'}}>
                                                {roleDisplay}
                                                {isAbsentee && ' (Absentee)'}
                                            </div>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}

                    {/* Interaction Type */}
                    <div style={{marginBottom: 24}}>
                        <h3>Interaction Type</h3>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                            <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                                <input
                                    type="checkbox"
                                    checked={spokeToHomeowner}
                                    onChange={(e) => setSpokeToHomeowner(e.target.checked)}
                                    style={{marginRight: 12}}
                                />
                                Spoke to homeowner/resident
                            </label>
                            
                            <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                                <input
                                    type="checkbox"
                                    checked={spokeToOther}
                                    onChange={(e) => setSpokeToOther(e.target.checked)}
                                    style={{marginRight: 12}}
                                />
                                Spoke to other person (visitor, family member, etc.)
                            </label>
                            
                            {spokeToOther && (
                                <div style={{marginLeft: 24, marginTop: 8}}>
                                    <input
                                        type="text"
                                        placeholder="Name of person you spoke to"
                                        value={otherPersonName}
                                        onChange={(e) => setOtherPersonName(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #ddd',
                                            borderRadius: 4
                                        }}
                                    />
                                </div>
                            )}
                            
                            <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                                <input
                                    type="checkbox"
                                    checked={leftFlyer}
                                    onChange={(e) => setLeftFlyer(e.target.checked)}
                                    style={{marginRight: 12}}
                                />
                                Left flyer/information
                            </label>
                        </div>
                    </div>

                    {/* Notes */}
                    <div style={{marginBottom: 24}}>
                        <label style={{display: 'block', marginBottom: 8, fontWeight: 'bold'}}>
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Record details of the interaction, response, questions asked, follow-up needed, etc."
                            style={{
                                width: '100%',
                                height: 120,
                                padding: '12px',
                                border: '1px solid #ddd',
                                borderRadius: 4,
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    {/* Submit Button */}
                    <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
                        <button
                            type="button"
                            onClick={() => window.close()}
                            style={{
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: 4,
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                backgroundColor: saving ? '#6c757d' : '#28a745',
                                color: 'white',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: 4,
                                cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {saving ? 'Recording...' : 'Record Interaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
