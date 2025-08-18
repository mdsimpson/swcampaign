import {Link} from 'react-router-dom'
import {useAuthenticator} from '@aws-amplify/ui-react'
import {useEffect, useState} from 'react'
import {fetchAuthSession} from 'aws-amplify/auth'

export default function Header() {
    const {signOut, user} = useAuthenticator(ctx => [ctx.user])
    const [userGroups, setUserGroups] = useState<string[]>([])

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

    const hasRole = (role: string) => userGroups.includes(role)
    const isCanvasser = hasRole('Canvasser') || hasRole('Organizer') || hasRole('Administrator')
    const isOrganizer = hasRole('Organizer') || hasRole('Administrator')
    const isAdmin = hasRole('Administrator')
    const isMember = hasRole('Member') || hasRole('Canvasser') || hasRole('Organizer') || hasRole('Administrator')

    return (
        <header style={{display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderBottom: '1px solid #eee'}}>
            <img src='/logo.png' alt='SWHOA' style={{height: 40}}/>
            <nav style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                <Link to='/'>Home</Link>
                {isCanvasser && <Link to='/canvass'>Canvass</Link>}
                {isCanvasser && <Link to='/absentee'>Absentee</Link>}
                {isOrganizer && <Link to='/reports'>Reports</Link>}
                {isOrganizer && <Link to='/organize'>Organize</Link>}
                {isAdmin && <Link to='/admin/enroll'>Enroll</Link>}
                {isAdmin && <Link to='/admin/consents'>Consents</Link>}
                {isAdmin && <Link to='/admin/residents'>Residents</Link>}
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
