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
                    setUserGroups(['Member']) // Default to Member role
                }
            }
        }
        getUserGroups()
    }, [user])

    const hasRole = (role: string) => userGroups.includes(role)
    const isCanvasser = hasRole('Canvasser') || hasRole('Organizer') || hasRole('Administrator')
    const isOrganizer = hasRole('Organizer') || hasRole('Administrator')
    const isAdmin = hasRole('Administrator')

    return (
        <header style={{display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderBottom: '1px solid #eee'}}>
            <img src='/logo.png' alt='SWHOA' style={{height: 40}}/>
            <nav style={{display: 'flex', gap: 12}}>
                <Link to='/'>Home</Link>
                {isCanvasser && <Link to='/canvass'>Canvass</Link>}
                {isCanvasser && <Link to='/absentee'>Absentee</Link>}
                {isOrganizer && <Link to='/reports'>Reports</Link>}
                {isOrganizer && <Link to='/organize'>Organize</Link>}
                {isAdmin && <Link to='/admin/enroll'>Enroll</Link>}
                {isAdmin && <Link to='/admin/votes'>Votes</Link>}
                <Link to='/profile'>Profile</Link>
            </nav>
            <div style={{marginLeft: 'auto'}}>
                {user ? <button onClick={signOut}>Logout</button> : <Link to='/landing'>Login</Link>}
            </div>
        </header>
    )
}
