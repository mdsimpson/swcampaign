import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'

export default function AbsenteeInteractions() {
    const [absenteeHomes, setAbsenteeHomes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedHome, setSelectedHome] = useState<any>(null)
    const [contactMethod, setContactMethod] = useState('')
    const [notes, setNotes] = useState('')

    const client = generateClient<Schema>()

    useEffect(() => {
        loadAbsenteeHomes()
    }, [])

    async function loadAbsenteeHomes() {
        try {
            const result = await client.models.Home.list()
            const absentee = result.data.filter(home => home.absenteeOwner)
            
            // Load residents for each home
            const homesWithResidents = await Promise.all(
                absentee.map(async (home) => {
                    const residentsResult = await client.models.Person.list({
                        filter: { homeId: { eq: home.id } }
                    })
                    return { ...home, residents: residentsResult.data }
                })
            )
            
            setAbsenteeHomes(homesWithResidents)
        } catch (error) {
            console.error('Failed to load absentee homes:', error)
        } finally {
            setLoading(false)
        }
    }

    async function recordContact(homeId: string) {
        if (!contactMethod || !notes.trim()) {
            alert('Please select a contact method and enter notes')
            return
        }

        try {
            await client.models.InteractionRecord.create({
                homeId,
                spokeToHomeowner: contactMethod === 'phone' || contactMethod === 'email',
                spokeToOther: false,
                leftFlyer: contactMethod === 'mail',
                notes: `Contact via ${contactMethod}: ${notes}`,
                createdAt: new Date().toISOString()
            })
            
            alert('Contact recorded successfully')
            setSelectedHome(null)
            setContactMethod('')
            setNotes('')
        } catch (error) {
            console.error('Failed to record contact:', error)
            alert('Failed to record contact')
        }
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1000, margin: '20px auto'}}>
                    <h2>Absentee Owners</h2>
                    <p>Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '20px auto', padding: 12}}>
                <h2>Absentee Owners ({absenteeHomes.length})</h2>
                <p>Properties where the mailing address differs from the property address.</p>
                
                {absenteeHomes.length === 0 ? (
                    <p>No absentee owners found.</p>
                ) : (
                    <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 16}}>
                            <thead>
                                <tr style={{backgroundColor: '#f8f9fa'}}>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Property Address</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Mailing Address</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Owners</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Contact Info</th>
                                    <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {absenteeHomes.map(home => (
                                    <tr key={home.id}>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.unitNumber && `${home.unitNumber} `}{home.street}<br/>
                                            {home.city}, {home.state} {home.postalCode}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.mailingStreet}<br/>
                                            {home.mailingCity}, {home.mailingState} {home.mailingPostalCode}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.residents?.map((person: any, i: number) => (
                                                <div key={person.id}>
                                                    {person.firstName} {person.lastName}
                                                    {person.role && ` (${person.role.replace('_', ' ')})`}
                                                    {i < home.residents.length - 1 && <br/>}
                                                </div>
                                            )) || 'No residents listed'}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {home.residents?.map((person: any, i: number) => (
                                                <div key={person.id} style={{fontSize: '0.9em'}}>
                                                    {person.email && <div>📧 {person.email}</div>}
                                                    {person.mobilePhone && <div>📱 {person.mobilePhone}</div>}
                                                    {i < home.residents.length - 1 && <br/>}
                                                </div>
                                            ))}
                                        </td>
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            <button 
                                                onClick={() => setSelectedHome(home)}
                                                style={{
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: 4,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Record Contact
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedHome && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            padding: 24,
                            borderRadius: 8,
                            maxWidth: 500,
                            width: '90%'
                        }}>
                            <h3>Record Contact: {selectedHome.street}</h3>
                            
                            <div style={{marginBottom: 16}}>
                                <label style={{display: 'block', marginBottom: 8}}>Contact Method:</label>
                                <select 
                                    value={contactMethod}
                                    onChange={(e) => setContactMethod(e.target.value)}
                                    style={{width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd'}}
                                >
                                    <option value="">Select method...</option>
                                    <option value="phone">Phone Call</option>
                                    <option value="email">Email</option>
                                    <option value="text">Text Message</option>
                                    <option value="mail">Postal Mail</option>
                                </select>
                            </div>

                            <div style={{marginBottom: 16}}>
                                <label style={{display: 'block', marginBottom: 8}}>Notes:</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Record details of contact attempt, response, etc..."
                                    style={{
                                        width: '100%',
                                        height: 100,
                                        padding: 8,
                                        borderRadius: 4,
                                        border: '1px solid #ddd',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                                <button
                                    onClick={() => {
                                        setSelectedHome(null)
                                        setContactMethod('')
                                        setNotes('')
                                    }}
                                    style={{
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => recordContact(selectedHome.id)}
                                    style={{
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: 4,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Record Contact
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
