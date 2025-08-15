import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {useAuthenticator} from '@aws-amplify/ui-react'
import {fetchAuthSession} from 'aws-amplify/auth'
import {Link} from 'react-router-dom'

export default function InternalHome() {
    const {user} = useAuthenticator(ctx => [ctx.user])
    const [stats, setStats] = useState({totalPeople: 0, consentsRecorded: 0, totalHomes: 0, homesWithAllConsents: 0})
    const [pendingRegistrations, setPendingRegistrations] = useState(0)
    const [outstandingAssignments, setOutstandingAssignments] = useState(0)
    const [userGroups, setUserGroups] = useState<string[]>([])
    
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
            const consents = await client.models.Consent.list()
            const people = await client.models.Person.list()
            const homes = await client.models.Home.list()
            
            const totalPeople = people.data.length
            const consentsRecorded = consents.data.length
            const totalHomes = homes.data.length
            
            // Calculate homes where ALL owners have signed
            const homeIds = new Set(homes.data.map(h => h.id))
            let homesWithAllConsents = 0
            
            for (const homeId of homeIds) {
                const homeOwners = people.data.filter(p => p.homeId === homeId)
                const homeConsents = consents.data.filter(c => c.homeId === homeId)
                
                // Check if all owners have signed
                if (homeOwners.length > 0 && homeConsents.length >= homeOwners.length) {
                    homesWithAllConsents++
                }
            }
            
            setStats({totalPeople, consentsRecorded, totalHomes, homesWithAllConsents})
        } catch (error) {
            console.error('Failed to load stats:', error)
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
            const assignments = await client.models.Assignment.list()
            const outstanding = assignments.data.filter(a => a.status === 'NOT_STARTED').length
            setOutstandingAssignments(outstanding)
        } catch (error) {
            console.error('Failed to load outstanding assignments:', error)
        }
    }

    const consentProgressPercent = stats.totalHomes > 0 ? (stats.homesWithAllConsents / stats.totalHomes) * 100 : 0
    const targetConsentsNeeded = Math.ceil(stats.totalHomes * 0.8)
    const progressToTarget = stats.totalHomes > 0 ? (stats.homesWithAllConsents / targetConsentsNeeded) * 100 : 0

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
                            <span>Homes with All Consents Signed (Need 80%)</span>
                            <span>{stats.homesWithAllConsents} / {targetConsentsNeeded} ({consentProgressPercent.toFixed(1)}%)</span>
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
                        <span>Total Homes: {stats.totalHomes}</span>
                        <span>Individual Consents: {stats.consentsRecorded}</span>
                        <span>Progress to 80%: {progressToTarget.toFixed(1)}%</span>
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
