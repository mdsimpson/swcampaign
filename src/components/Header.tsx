import { Link } from 'react-router-dom'
import { useAuthenticator } from '@aws-amplify/ui-react'
export default function Header(){
    const { signOut, user } = useAuthenticator(ctx => [ctx.user])
    return (
        <header style={{display:'flex',alignItems:'center',gap:16,padding:12,borderBottom:'1px solid #eee'}}>
            <img src='/logo.png' alt='SWHOA' style={{height:40}} />
            <nav style={{display:'flex',gap:12}}>
                <Link to='/'>Home</Link>
                <Link to='/canvass'>Canvass</Link>
                <Link to='/reports'>Reports</Link>
                <Link to='/organize'>Organize</Link>
                <Link to='/admin/enroll'>Enroll</Link>
                <Link to='/admin/votes'>Votes</Link>
                <Link to='/profile'>Profile</Link>
            </nav>
            <div style={{marginLeft:'auto'}}>
                {user ? <button onClick={signOut}>Logout</button> : <Link to='/landing'>Login</Link>}
            </div>
        </header>
    )
}
