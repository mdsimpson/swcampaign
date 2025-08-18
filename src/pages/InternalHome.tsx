import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {useAuthenticator} from '@aws-amplify/ui-react'
import {fetchAuthSession} from 'aws-amplify/auth'
import {Link} from 'react-router-dom'
import { QUERY_LIMITS, loadAllRecords } from '../config/queries'

export default function InternalHome() {
    const {user} = useAuthenticator(ctx => [ctx.user])
    const [stats, setStats] = useState({totalResidents: 0, consentsRecorded: 0, totalAddresses: 0, addressesWithAllConsents: 0})
    const [pendingRegistrations, setPendingRegistrations] = useState(0)
    const [outstandingAssignments, setOutstandingAssignments] = useState(0)
    const [userGroups, setUserGroups] = useState<string[]>([])
    const [statsLoaded, setStatsLoaded] = useState(false)
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    useEffect(() => {
        loadStats()
        
        async function getUserGroups() {
            if (user) {
                try {
                    const session = await fetchAuthSession()
                    const groups = session.tokens?.idToken?.payload['cognito:groups'] || ['Member']
                    setUserGroups(groups)
                    
                    if (groups.includes('Administrator')) {
                        loadPendingRegistrations()
                    }
                    if (groups.includes('Canvasser') || groups.includes('Organizer') || groups.includes('Administrator')) {
                        loadOutstandingAssignments()
                    }
                } catch (error) {
                    console.error('Failed to fetch user groups:', error)
                    setUserGroups(['Member']) // Default to Member role
                }
            }
        }
        getUserGroups()
    }, [user])

    async function loadStats() {
        try {
            // Load ALL consents and residents using centralized config
            const [allConsents, allResidents] = await Promise.all([
                loadAllRecords(
                    (config) => client.models.Consent.list(config),
                    QUERY_LIMITS.CONSENTS_BATCH_SIZE
                ),
                loadAllRecords(
                    (config) => client.models.Resident.list(config),
                    QUERY_LIMITS.RESIDENTS_BATCH_SIZE
                )
            ])
            
            const consents = { data: allConsents }
            const residents = { data: allResidents }
            
            // Check if we're hitting pagination limits
            let allAddresses = []
            let nextToken = null
            let totalCount = 0
            
            do {
                const addressesQuery = await client.models.Address.list({
                    limit: QUERY_LIMITS.ADDRESSES_BATCH_SIZE,
                    nextToken: nextToken
                })
                allAddresses.push(...addressesQuery.data)
                nextToken = addressesQuery.nextToken
                totalCount += addressesQuery.data.length
            } while (nextToken)
            
            
            // Check for duplicates by address
            const addressMap = new Map()
            allAddresses.forEach(address => {
                const addressKey = `${address.street}, ${address.city}`.toLowerCase()
                if (addressMap.has(addressKey)) {
                    addressMap.set(addressKey, addressMap.get(addressKey) + 1)
                } else {
                    addressMap.set(addressKey, 1)
                }
            })
            
            const duplicates = Array.from(addressMap.entries()).filter(([address, count]) => count > 1)
            
            const uniqueAddresses = addressMap.size
            
            // For now, let's use the unique address count for the display
            const totalAddresses = uniqueAddresses
            
            const totalResidents = residents.data.length
            const consentsRecorded = consents.data.length
            
            // Calculate addresses where ALL residents have signed
            const addressIds = new Set(allAddresses.map(a => a.id))
            let addressesWithAllConsents = 0
            
            for (const addressId of addressIds) {
                const addressResidents = residents.data.filter(r => r.addressId === addressId)
                const addressConsents = consents.data.filter(c => c.addressId === addressId)
                
                // Check if all residents have signed
                if (addressResidents.length > 0 && addressConsents.length >= addressResidents.length) {
                    addressesWithAllConsents++
                }
            }
            
            setStats({totalResidents, consentsRecorded, totalAddresses, addressesWithAllConsents})
            setStatsLoaded(true)
        } catch (error) {
            console.error('Failed to load stats:', error)
            setStatsLoaded(true)
        }
    }

    async function loadPendingRegistrations() {
        try {
            const registrations = await client.models.Registration.list()
            const pending = registrations.data.filter(r => r.status === 'SUBMITTED').length
            setPendingRegistrations(pending)
        } catch (error) {
            console.error('Failed to load pending registrations:', error)
        }
    }

    async function loadOutstandingAssignments() {
        try {
            if (!user) return
            
            // Get the current user's sub (unique identifier)
            const userSub = user.username
            
            // Find the volunteer record for this user
            const volunteers = await client.models.Volunteer.list({
                filter: { userSub: { eq: userSub } }
            })
            
            if (volunteers.data.length === 0) {
                // User doesn't have a volunteer record, so no assignments
                setOutstandingAssignments(0)
                return
            }
            
            const volunteerId = volunteers.data[0].id
            
            // Load assignments for this volunteer only
            const assignments = await client.models.Assignment.list({
                filter: { volunteerId: { eq: volunteerId } }
            })
            
            // Count assignments that are NOT_STARTED
            const notStartedAssignments = assignments.data.filter(a => a.status === 'NOT_STARTED')
            
            // Use unique addresses to avoid counting duplicates
            const uniqueAddressIds = new Set(notStartedAssignments.map(a => a.addressId))
            
            // Use the unique address count instead of total assignment count
            const outstanding = uniqueAddressIds.size
            setOutstandingAssignments(outstanding)
        } catch (error) {
            console.error('Failed to load outstanding assignments:', error)
        }
    }

    const consentProgressPercent = stats.totalAddresses > 0 ? (stats.addressesWithAllConsents / stats.totalAddresses) * 100 : 0
    const targetConsentsNeeded = stats.totalAddresses  // Show total addresses instead of 80%
    const progressToTarget = stats.totalAddresses > 0 ? (stats.addressesWithAllConsents / stats.totalAddresses) * 100 : 0

    const hasRole = (role: string) => userGroups.includes(role)
    const isCanvasser = hasRole('Canvasser') || hasRole('Organizer') || hasRole('Administrator')
    const isOrganizer = hasRole('Organizer') || hasRole('Administrator')
    const isAdmin = hasRole('Administrator')

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 900, margin: '20px auto', padding: 16}}>
                <h2>Campaign Progress</h2>
                
                <div style={{marginBottom: 24}}>
                    <h3>Consent Form Progress</h3>
                    <div style={{marginBottom: 12}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                            <span>Addresses with All Consents Signed</span>
                            <span>{statsLoaded ? `${stats.addressesWithAllConsents} / ${targetConsentsNeeded} (${consentProgressPercent.toFixed(1)}%)` : ''}</span>
                        </div>
                        <div style={{backgroundColor: '#e0e0e0', borderRadius: 4, height: 20}}>
                            <div style={{
                                backgroundColor: progressToTarget >= 100 ? '#4caf50' : '#ff9800',
                                width: `${Math.min(progressToTarget, 100)}%`,
                                height: '100%',
                                borderRadius: 4,
                                transition: 'width 0.3s ease'
                            }}/>
                        </div>
                    </div>

                    <div style={{display: 'flex', gap: 20, fontSize: 14}}>
                        <span>Total Addresses: {statsLoaded ? stats.totalAddresses : ''}</span>
                        <span>Individual Consents: {statsLoaded ? stats.consentsRecorded : ''}</span>
                        <span>Progress to 80%: {statsLoaded ? progressToTarget.toFixed(1) + '%' : ''}</span>
                    </div>
                </div>

                <div style={{marginBottom: 24}}>
                    <h3>Inbox</h3>
                    
                    {isCanvasser && outstandingAssignments > 0 && (
                        <div style={{backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4, padding: 12, marginBottom: 12}}>
                            <strong>Canvassing Assignments:</strong> You have {outstandingAssignments} houses outstanding to canvas.
                            <div style={{marginTop: 8}}>
                                <Link to='/canvass' style={{marginRight: 12}}>Go to Canvassing Page</Link>
                                <Link to='/absentee'>Record Absentee Owner Interaction</Link>
                            </div>
                        </div>
                    )}

                    {isAdmin && pendingRegistrations > 0 && (
                        <div style={{backgroundColor: '#d1ecf1', border: '1px solid #bee5eb', borderRadius: 4, padding: 12, marginBottom: 12}}>
                            <strong>Registrations to Review:</strong> {pendingRegistrations} new registration(s) need approval.
                            <div style={{marginTop: 8}}>
                                <Link to='/admin/enroll'>Review Registrations</Link>
                            </div>
                        </div>
                    )}

                    {(!isCanvasser || outstandingAssignments === 0) && (!isAdmin || pendingRegistrations === 0) && (
                        <p style={{color: '#666', fontStyle: 'italic'}}>No pending actions.</p>
                    )}
                </div>

                {isOrganizer && (
                    <div style={{marginBottom: 24}}>
                        <h3>Actions</h3>
                        <Link to='/organize'>Organize Canvassing</Link>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3>Administrative Actions</h3>
                        <div style={{display: 'flex', gap: 16}}>
                            <Link to='/admin/enroll'>Change User Roles</Link>
                            <Link to='/admin/enroll'>Manage User Access</Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
