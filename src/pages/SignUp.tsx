import { useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import { Link } from 'react-router-dom'
const client = generateClient<Schema>()
export default function SignUp(){
    const [form,setForm] = useState({ email:'', password:'', firstName:'', lastName:'', street:'', mobile:'' })
    const [submitted,setSubmitted] = useState(false)
    async function submit(e:React.FormEvent){ e.preventDefault();
        await client.models.Registration.create({ email:form.email, firstName:form.firstName, lastName:form.lastName, street:form.street, mobile:form.mobile, submittedAt: new Date().toISOString() })
        setSubmitted(true)
    }
    if (submitted) return (<div style={{maxWidth:700,margin:'40px auto'}}><h2>Thanks!</h2><p>We’ll email you next steps; admins were notified.</p><p><Link to='/landing'>Back to login</Link></p></div>)
    return (
        <form onSubmit={submit} style={{maxWidth:600,margin:'40px auto',display:'grid',gap:12}}>
            <h2>Sign-up for Login</h2>
            <p>You must be verified as an SWHOA member before your login is granted.</p>
            <input required placeholder='Email' type='email' value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            <input required placeholder='Password (min 12 chars)' type='password' value={form.password} onChange={e=>setForm({...form,password:e.target.value})} minLength={12} />
            <input required placeholder='First Name' value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} />
            <input required placeholder='Last Name' value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} />
            <input required placeholder='Street Address' value={form.street} onChange={e=>setForm({...form,street:e.target.value})} />
            <input placeholder='Mobile Phone' value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} />
            <button type='submit'>Submit Registration</button>
        </form>
    )
}
