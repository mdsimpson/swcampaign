import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'

export default function EnrollMembers() {
    const [registrations, setRegistrations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [sortField, setSortField] = useState<string>('submittedAt')
    const [sortAsc, setSortAsc] = useState(false)
    
    const client = generateClient<Schema>()

    useEffect(() => {
        loadRegistrations()
    }, [])

    async function loadRegistrations() {
        try {
            const result = await client.models.Registration.list()
            const pending = result.data.filter(r => r.status === 'SUBMITTED')
            setRegistrations(pending)
        } catch (error) {
            console.error('Failed to load registrations:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleAccept(registration: any) {
        try {
            await client.models.Registration.update({
                id: registration.id,
                status: 'ACCEPTED'
            })
            
            await client.models.UserProfile.create({
                sub: `pending-${registration.id}`,
                email: registration.email,
                firstName: registration.firstName,
                lastName: registration.lastName,
                street: registration.street,
                mobile: registration.mobile,
                roleCache: 'Member'
            })

            setRegistrations(prev => prev.filter(r => r.id !== registration.id))
            alert(`${registration.firstName} ${registration.lastName} has been accepted and will be notified by email.`)
        } catch (error) {
            console.error('Failed to accept registration:', error)
            alert('Failed to accept registration')
        }
    }

    async function handleReject(registration: any) {
        if (!confirm(`Are you sure you want to reject ${registration.firstName} ${registration.lastName}?`)) {
            return
        }

        try {
            await client.models.Registration.update({
                id: registration.id,
                status: 'REJECTED'
            })
            
            setRegistrations(prev => prev.filter(r => r.id !== registration.id))
            alert(`${registration.firstName} ${registration.lastName} has been rejected.`)
        } catch (error) {
            console.error('Failed to reject registration:', error)
            alert('Failed to reject registration')
        }
    }

    function handleSort(field: string) {
        if (sortField === field) {
            setSortAsc(!sortAsc)
        } else {
            setSortField(field)
            setSortAsc(true)
        }
    }

    const sortedRegistrations = [...registrations].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sortAsc ? comparison : -comparison
    })

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 1000, margin: '20px auto', textAlign: 'center'}}>
                    <h2>Loading registrations...</h2>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '20px auto', padding: 16}}>
                <h2>Enroll Members ({registrations.length} pending)</h2>
                
                {registrations.length === 0 ? (
                    <p>No pending registrations.</p>
                ) : (
                    <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd'}}>
                            <thead>
                                <tr style={{backgroundColor: '#f5f5f5'}}>
                                    <th style={{padding: 12, border: '1px solid #ddd', cursor: 'pointer'}} 
                                        onClick={() => handleSort('submittedAt')}>
                                        Submitted {sortField === 'submittedAt' && (sortAsc ? '↑' : '↓')}
                                    </th>
                                    <th style={{padding: 12, border: '1px solid #ddd', cursor: 'pointer'}} 
                                        onClick={() => handleSort('email')}>
                                        Email {sortField === 'email' && (sortAsc ? '↑' : '↓')}
                                    </th>
                                    <th style={{padding: 12, border: '1px solid #ddd', cursor: 'pointer'}} 
                                        onClick={() => handleSort('firstName')}>
                                        First Name {sortField === 'firstName' && (sortAsc ? '↑' : '↓')}
                                    </th>
                                    <th style={{padding: 12, border: '1px solid #ddd', cursor: 'pointer'}} 
                                        onClick={() => handleSort('lastName')}>
                                        Last Name {sortField === 'lastName' && (sortAsc ? '↑' : '↓')}
                                    </th>
                                    <th style={{padding: 12, border: '1px solid #ddd', cursor: 'pointer'}} 
                                        onClick={() => handleSort('street')}>
                                        Street Address {sortField === 'street' && (sortAsc ? '↑' : '↓')}
                                    </th>
                                    <th style={{padding: 12, border: '1px solid #ddd', cursor: 'pointer'}} 
                                        onClick={() => handleSort('mobile')}>
                                        Mobile {sortField === 'mobile' && (sortAsc ? '↑' : '↓')}
                                    </th>
                                    <th style={{padding: 12, border: '1px solid #ddd'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRegistrations.map(reg => (
                                    <tr key={reg.id}>
                                        <td style={{padding: 12, border: '1px solid #ddd', fontSize: 14}}>
                                            {new Date(reg.submittedAt).toLocaleDateString()} {new Date(reg.submittedAt).toLocaleTimeString()}
                                        </td>
                                        <td style={{padding: 12, border: '1px solid #ddd'}}>{reg.email}</td>
                                        <td style={{padding: 12, border: '1px solid #ddd'}}>{reg.firstName}</td>
                                        <td style={{padding: 12, border: '1px solid #ddd'}}>{reg.lastName}</td>
                                        <td style={{padding: 12, border: '1px solid #ddd'}}>{reg.street}</td>
                                        <td style={{padding: 12, border: '1px solid #ddd'}}>{reg.mobile || '-'}</td>
                                        <td style={{padding: 12, border: '1px solid #ddd'}}>
                                            <div style={{display: 'flex', gap: 8}}>
                                                <button 
                                                    onClick={() => handleAccept(reg)}
                                                    style={{backgroundColor: '#28a745', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer'}}
                                                >
                                                    Accept
                                                </button>
                                                <button 
                                                    onClick={() => handleReject(reg)}
                                                    style={{backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer'}}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
