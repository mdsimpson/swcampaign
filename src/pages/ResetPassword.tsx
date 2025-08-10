import {useState} from 'react'
import {Auth} from 'aws-amplify'
import {Link} from 'react-router-dom'

export default function ResetPassword() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [code, setCode] = useState('');
    const [newPass, setNewPass] = useState('');
    const [done, setDone] = useState(false)

    async function send() {
        if (!email) return alert('Enter your email first');
        await Auth.forgotPassword(email);
        setSent(true)
    }

    async function confirm() {
        await Auth.forgotPasswordSubmit(email, code, newPass);
        setDone(true)
    }

    if (done) return <div style={{maxWidth: 600, margin: '40px auto'}}><h2>Password reset!</h2><p><Link to='/landing'>Return
        to login</Link></p></div>
    return (
        <div style={{maxWidth: 600, margin: '40px auto'}}>
            <h2>Forgot My Password</h2>
            {!sent ? (
                <div style={{display: 'grid', gap: 8}}>
                    <input placeholder='Email' value={email} onChange={e => setEmail(e.target.value)}/>
                    <button onClick={send}>Email me a reset code</button>
                </div>
            ) : (
                <div style={{display: 'grid', gap: 8}}>
                    <input placeholder='Verification code' value={code} onChange={e => setCode(e.target.value)}/>
                    <input placeholder='New password (min 12 chars)' type='password' value={newPass} minLength={12}
                           onChange={e => setNewPass(e.target.value)}/>
                    <button onClick={confirm}>Set new password</button>
                </div>
            )}
        </div>
    )
}
