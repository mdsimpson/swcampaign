import {useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {Link} from 'react-router-dom'

function validatePassword(password: string): string[] {
    const errors = []
    if (password.length < 12) errors.push('Must be at least 12 characters long')
    if (!/[a-z]/.test(password)) errors.push('Must contain at least one lowercase letter')
    if (!/[A-Z]/.test(password)) errors.push('Must contain at least one uppercase letter')
    if (!/\d/.test(password)) errors.push('Must contain at least one number')
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain at least one special character')
    return errors
}

export default function SignUp() {
    const [form, setForm] = useState({email: '', password: '', firstName: '', lastName: '', street: '', mobile: ''})
    const [submitted, setSubmitted] = useState(false)
    const [passwordErrors, setPasswordErrors] = useState<string[]>([])
    
    const client = generateClient<Schema>({
        authMode: 'apiKey'
    })

    function handlePasswordChange(password: string) {
        setForm({...form, password})
        setPasswordErrors(validatePassword(password))
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        console.log('Form submitted with data:', form)
        
        const errors = validatePassword(form.password)
        if (errors.length > 0) {
            console.log('Password validation errors:', errors)
            setPasswordErrors(errors)
            return
        }
        
        try {
            console.log('Creating registration...')
            const result = await client.models.Registration.create({
                email: form.email,
                firstName: form.firstName,
                lastName: form.lastName,
                street: form.street,
                mobile: form.mobile,
                submittedAt: new Date().toISOString(),
                status: 'SUBMITTED'
            })
            console.log('Registration created successfully:', result)
            setSubmitted(true)
        } catch (error) {
            console.error('Error creating registration:', error)
            alert('Failed to submit registration. Please try again.')
        }
    }

    if (submitted) return (
        <div style={{maxWidth: 700, margin: '40px auto'}}><h2>Thanks!</h2><p>We’ll email you next steps; admins were
            notified.</p><p><Link to='/landing'>Back to login</Link></p></div>)
    return (
        <form onSubmit={submit} style={{maxWidth: 600, margin: '40px auto', display: 'grid', gap: 12}}>
            <h2>Sign-up for Login</h2>
            <p>You must be verified as an SWHOA member before your login is granted.</p>
            <p style={{fontSize: 14, color: '#666', fontStyle: 'italic'}}>
                <span style={{color: '#dc3545'}}>*</span> indicates required fields
            </p>
            <p style={{fontSize: 14, color: '#666'}}>
                Please provide your street address (e.g., "123 Main St") - city, state, and zip are not needed.
            </p>
            
            <div>
                <input required placeholder='Email *' type='email' value={form.email}
                       onChange={e => setForm({...form, email: e.target.value})}
                       style={{
                           border: `2px solid ${form.email ? '#28a745' : '#dc3545'}`,
                           width: '100%',
                           padding: '12px 16px',
                           fontSize: '16px',
                           borderRadius: '6px',
                           boxSizing: 'border-box'
                       }}/>
            </div>
            
            <div>
                <input required placeholder='Password (min 12 chars) *' type='password' value={form.password}
                       onChange={e => handlePasswordChange(e.target.value)} minLength={12}
                       style={{
                           border: `2px solid ${passwordErrors.length === 0 && form.password ? '#28a745' : '#dc3545'}`,
                           width: '100%',
                           padding: '12px 16px',
                           fontSize: '16px',
                           borderRadius: '6px',
                           boxSizing: 'border-box'
                       }}/>
                {passwordErrors.length > 0 && (
                    <div style={{color: '#dc3545', fontSize: 14, marginTop: 4}}>
                        Password requirements:
                        <ul style={{margin: '4px 0', paddingLeft: 20}}>
                            {passwordErrors.map((error, i) => <li key={i}>{error}</li>)}
                        </ul>
                    </div>
                )}
            </div>
            
            <div>
                <input required placeholder='First Name *' value={form.firstName}
                       onChange={e => setForm({...form, firstName: e.target.value})}
                       style={{
                           border: `2px solid ${form.firstName ? '#28a745' : '#dc3545'}`,
                           width: '100%',
                           padding: '12px 16px',
                           fontSize: '16px',
                           borderRadius: '6px',
                           boxSizing: 'border-box'
                       }}/>
            </div>
            
            <div>
                <input required placeholder='Last Name *' value={form.lastName}
                       onChange={e => setForm({...form, lastName: e.target.value})}
                       style={{
                           border: `2px solid ${form.lastName ? '#28a745' : '#dc3545'}`,
                           width: '100%',
                           padding: '12px 16px',
                           fontSize: '16px',
                           borderRadius: '6px',
                           boxSizing: 'border-box'
                       }}/>
            </div>
            
            <div>
                <input required placeholder='Street Address *' value={form.street}
                       onChange={e => setForm({...form, street: e.target.value})}
                       style={{
                           border: `2px solid ${form.street ? '#28a745' : '#dc3545'}`,
                           width: '100%',
                           padding: '12px 16px',
                           fontSize: '16px',
                           borderRadius: '6px',
                           boxSizing: 'border-box'
                       }}/>
            </div>
            
            <div>
                <input required placeholder='Mobile Phone *' type='tel' value={form.mobile}
                       onChange={e => setForm({...form, mobile: e.target.value})}
                       style={{
                           border: `2px solid ${form.mobile ? '#28a745' : '#dc3545'}`,
                           width: '100%',
                           padding: '12px 16px',
                           fontSize: '16px',
                           borderRadius: '6px',
                           boxSizing: 'border-box'
                       }}/>
            </div>
            
            <button type='submit' style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '8px'
            }}>Submit Registration</button>
        </form>
    )
}
