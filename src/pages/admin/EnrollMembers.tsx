import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import {fetchAuthSession} from 'aws-amplify/auth'
import {CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand} from '@aws-sdk/client-cognito-identity-provider'

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
            console.log('Loading registrations as admin...')
            const result = await client.models.Registration.list()
            console.log(`Found ${result.data.length} total registrations`)
            const pending = result.data.filter(r => r.status === 'SUBMITTED')
            console.log(`Filtered to ${pending.length} pending registrations`)
            setRegistrations(pending)
        } catch (error) {
            console.error('Failed to load registrations:', error)
            alert(`Failed to load registrations: ${error.message}. Make sure you are logged in as an Administrator.`)
        } finally {
            setLoading(false)
        }
    }

    async function handleAccept(registration: any) {
        try {
            // Generate a temporary password
            const tempPassword = generateTemporaryPassword()
            
            // Get current auth session for credentials
            const session = await fetchAuthSession()
            
            // Create Cognito client with credentials from current session
            // The key change: use the credentials that include the Administrator group permissions
            const cognitoClient = new CognitoIdentityProviderClient({
                region: 'us-east-1',
                credentials: session.credentials
            })
            
            const userPoolId = 'us-east-1_GrxwbZK9I'
            
            // Create Cognito user account
            console.log(`Creating Cognito user for ${registration.email}`)
            const createUserResult = await cognitoClient.send(new AdminCreateUserCommand({
                UserPoolId: userPoolId,
                Username: registration.email,
                UserAttributes: [
                    { Name: 'email', Value: registration.email },
                    { Name: 'email_verified', Value: 'true' },
                    { Name: 'given_name', Value: registration.firstName },
                    { Name: 'family_name', Value: registration.lastName }
                ],
                TemporaryPassword: tempPassword,
                MessageAction: 'SUPPRESS' // Don't send the default email, we'll handle communication separately
            }))
            
            const userSub = createUserResult.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value
            
            if (!userSub) {
                throw new Error('Failed to get user sub from created user')
            }
            
            // Add user to Member group
            console.log(`Adding user to Member group`)
            await cognitoClient.send(new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: registration.email,
                GroupName: 'Member'
            }))
            
            // Update registration status
            await client.models.Registration.update({
                id: registration.id,
                status: 'ACCEPTED'
            })
            
            // Create user profile with actual user sub
            await client.models.UserProfile.create({
                sub: userSub,
                email: registration.email,
                firstName: registration.firstName,
                lastName: registration.lastName,
                street: registration.street,
                mobile: registration.mobile,
                roleCache: 'Member'
            })

            setRegistrations(prev => prev.filter(r => r.id !== registration.id))
            alert(`${registration.firstName} ${registration.lastName} has been accepted! 

✅ Cognito user account created successfully
✅ Added to Member group  
✅ User profile created

Login Details:
• Email: ${registration.email}
• Temporary Password: ${tempPassword}

Please provide these credentials to the user so they can log in and set their permanent password.`)
        } catch (error) {
            console.error('Failed to accept registration:', error)
            alert(`Failed to accept registration: ${error.message}`)
        }
    }
    
    function generateTemporaryPassword(): string {
        // Generate a secure temporary password that meets Cognito requirements
        const lowercase = 'abcdefghijklmnopqrstuvwxyz'
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const numbers = '0123456789'
        const symbols = '!@#$%^&*'
        
        // Ensure at least one character from each category
        let password = ''
        password += lowercase[Math.floor(Math.random() * lowercase.length)]
        password += uppercase[Math.floor(Math.random() * uppercase.length)]
        password += numbers[Math.floor(Math.random() * numbers.length)]
        password += symbols[Math.floor(Math.random() * symbols.length)]
        
        // Fill remaining length with random characters
        const allChars = lowercase + uppercase + numbers + symbols
        for (let i = 4; i < 12; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)]
        }
        
        // Shuffle the password to randomize character positions
        return password.split('').sort(() => Math.random() - 0.5).join('')
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
