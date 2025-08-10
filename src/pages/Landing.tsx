import { Authenticator } from '@aws-amplify/ui-react'
import { Link, useNavigate } from 'react-router-dom'
export default function Landing(){
    const nav = useNavigate()
    return (
        <div style={{maxWidth:900,margin:'40px auto',padding:16}}>
            <div style={{textAlign:'center'}}>
                <img src='/logo.png' alt='Vote to End SWHOA' style={{maxWidth:220}}/>
                <h1>Vote to End SWHOA</h1>
                <p>Log in or register to participate.</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginTop:24}}>
                <div>
                    <h3>Login</h3>
                    <Authenticator formFields={{ signIn: { username: { label: 'Email' } } }}>
                        {({ user }) => nav('/')}
                    </Authenticator>
                    <p><Link to='/reset'>Forgot my password</Link></p>
                </div>
                <div>
                    <h3>New here?</h3>
                    <p><Link to='/signup'>Sign-up for a login</Link></p>
                </div>
            </div>
        </div>
    )
}
