import {Link} from 'react-router-dom'
import {useAuthenticator} from '@aws-amplify/ui-react'
import {useEffect, useState} from 'react'
import {fetchAuthSession} from 'aws-amplify/auth'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'

export default function Header() {
    const {signOut, user} = useAuthenticator(ctx => [ctx.user])
    const [userGroups, setUserGroups] = useState<string[]>([])
    const [adminMenuOpen, setAdminMenuOpen] = useState(false)
    const [dataAsOfDate, setDataAsOfDate] = useState<string | null>(null)

    const client = generateClient<Schema>()

    useEffect(() => {
        async function getUserGroups() {
            if (user) {
                try {
                    const session = await fetchAuthSession()
                    const groups = session.tokens?.idToken?.payload['cognito:groups'] || []
                    setUserGroups(groups)
                } catch (error) {
                    console.error('Failed to fetch user groups:', error)
                    setUserGroups([]) // No groups assigned yet
                }
            }
        }
        getUserGroups()
    }, [user])

    useEffect(() => {
        loadDataAsOfDate()
    }, [])

    async function loadDataAsOfDate() {
        try {
            const result = await client.models.SystemConfig.list({
                filter: {
                    configKey: {
                        eq: 'dataAsOfDate'
                    }
                }
            })

            if (result.data.length > 0 && result.data[0].configValue) {
                setDataAsOfDate(result.data[0].configValue)
            }
        } catch (error) {
            console.error('Failed to load data as of date:', error)
        }
    }

    const hasRole = (role: string) => userGroups.includes(role)
    const isCanvasser = hasRole('Canvasser') || hasRole('Organizer') || hasRole('Administrator')
    const isOrganizer = hasRole('Organizer') || hasRole('Administrator')
    const isAdmin = hasRole('Administrator')
    const isMember = hasRole('Member') || hasRole('Canvasser') || hasRole('Organizer') || hasRole('Administrator')

    return (
        <header style={{display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderBottom: '1px solid #eee'}}>
            <img src='/logo.png' alt='SWHOA' style={{height: 40}}/>
            {dataAsOfDate && (
                <div style={{
                    fontSize: '0.85em',
                    color: '#666',
                    fontStyle: 'italic',
                    paddingLeft: 8,
                    borderLeft: '1px solid #ddd'
                }}>
                    Data as of {new Date(dataAsOfDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
            )}
            <nav style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                <Link to='/'>Home</Link>
                {isCanvasser && <Link to='/canvass'>Canvass</Link>}
                {isCanvasser && <Link to='/absentee'>Absentee</Link>}
                {isOrganizer && <Link to='/reports'>Reports</Link>}
                {isOrganizer && <Link to='/organize'>Organize</Link>}
                {isOrganizer && <Link to='/members'>Members</Link>}
                {isAdmin && (
                    <div style={{position: 'relative'}}>
                        <button
                            onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                            onBlur={() => setTimeout(() => setAdminMenuOpen(false), 200)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                fontSize: 'inherit',
                                padding: 0,
                                textDecoration: 'none'
                            }}
                        >
                            Admin ▾
                        </button>
                        {adminMenuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: 8,
                                backgroundColor: 'white',
                                border: '1px solid #ddd',
                                borderRadius: 4,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                minWidth: 180,
                                zIndex: 1000
                            }}>
                                <Link
                                    to='/admin/enroll'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Enroll Members
                                </Link>
                                <Link
                                    to='/admin/consents'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Record Consents
                                </Link>
                                <Link
                                    to='/admin/residents'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Manage Residents
                                </Link>
                                <Link
                                    to='/admin/addresses'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Manage Addresses
                                </Link>
                                <Link
                                    to='/admin/data'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Data Management
                                </Link>
                                <Link
                                    to='/admin/add-residents'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Add Residents
                                </Link>
                                <Link
                                    to='/admin/move-former-owners'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Move Former Owners
                                </Link>
                                <Link
                                    to='/admin/export-unsigned'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Export Unsigned
                                </Link>
                                <Link
                                    to='/admin/upload-deed-data'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    Upload Deed Data
                                </Link>
                                <Link
                                    to='/admin/set-data-date'
                                    onClick={() => setAdminMenuOpen(false)}
                                    style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        textDecoration: 'none',
                                        color: 'inherit'
                                    }}
                                >
                                    Set Data Date
                                </Link>
                            </div>
                        )}
                    </div>
                )}
                {isMember && <Link to='/profile'>Profile</Link>}
                {user && userGroups.length === 0 && (
                    <span style={{
                        color: '#856404',
                        backgroundColor: '#fff3cd',
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: '0.85em',
                        border: '1px solid #ffeaa7'
                    }}>
                        Pending Approval
                    </span>
                )}
            </nav>
            <div style={{marginLeft: 'auto'}}>
                {user ? <button onClick={signOut}>Logout</button> : <Link to='/landing'>Login</Link>}
            </div>
        </header>
    )
}
