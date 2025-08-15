import {Authenticator} from '@aws-amplify/ui-react'
import {Link, useNavigate} from 'react-router-dom'

export default function Landing() {
    const nav = useNavigate()
    return (
        <div style={{maxWidth: 900, margin: '40px auto', padding: 16}}>
            <div style={{textAlign: 'center'}}>
                <img src='/logo.png' alt='Vote to End SWHOA' style={{maxWidth: 220}}/>
                <h1>Vote to End SWHOA</h1>
                <p>Log in or register to participate.</p>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24}}>
                <div>
                    <h3>Already have an account?</h3>
                    <Authenticator 
                        hideSignUp
                        formFields={{
                            signIn: {username: {label: 'Email'}}
                        }}
                    >
                        {({user}) => nav('/')}
                    </Authenticator>
                    <p><Link to='/reset'>Forgot my password</Link></p>
                </div>
                <div>
                    <h3>Create Account</h3>
                    <p>
                        <Link 
                            to='/signup' 
                            style={{
                                display: 'inline-block',
                                backgroundColor: '#007bff',
                                color: 'white',
                                padding: '12px 24px',
                                textDecoration: 'none',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                fontSize: '16px'
                            }}
                        >
                            Sign Up for Account
                        </Link>
                    </p>
                    <p style={{fontSize: '0.9em', color: '#666', marginTop: '12px'}}>
                        <strong>Registration includes:</strong><br/>
                        • First Name & Last Name<br/>
                        • Street Address<br/>
                        • Mobile Phone Number<br/>
                        • Email & Password
                    </p>
                </div>
            </div>
        </div>
    )
}
