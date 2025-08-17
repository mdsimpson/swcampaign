import Header from '../../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../../amplify/data/resource'
import {fetchAuthSession} from 'aws-amplify/auth'
import { QUERY_LIMITS } from '../../config/queries'
import {CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, ListUsersCommand, AdminDeleteUserCommand, AdminGetUserCommand, AdminListGroupsForUserCommand, AdminRemoveUserFromGroupCommand} from '@aws-sdk/client-cognito-identity-provider'
import {getCurrentUser} from 'aws-amplify/auth'

export default function EnrollMembers() {
    const [registrations, setRegistrations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [sortField, setSortField] = useState<string>('submittedAt')
    const [sortAsc, setSortAsc] = useState(false)
    const [users, setUsers] = useState<any[]>([])
    const [usersLoading, setUsersLoading] = useState(true)
    const [currentUserEmail, setCurrentUserEmail] = useState<string>('')
    const [selectedRoles, setSelectedRoles] = useState<{[key: string]: string}>({})
    
    const client = generateClient<Schema>()

    useEffect(() => {
        loadRegistrations()
        loadUsers()
        getCurrentUserEmail()
    }, [])
    
    async function getCurrentUserEmail() {
        try {
            const user = await getCurrentUser()
            const userEmail = user.signInDetails?.loginId || user.username
            setCurrentUserEmail(userEmail)
        } catch (error) {
            console.error('Failed to get current user:', error)
        }
    }

    async function loadRegistrations() {
        try {
            const result = await client.models.Registration.list({ limit: QUERY_LIMITS.REGISTRATIONS_LIMIT })
            const pending = result.data.filter(r => r.status === 'SUBMITTED')
            setRegistrations(pending)
        } catch (error) {
            console.error('Failed to load registrations:', error)
            alert(`Failed to load registrations: ${error.message}. Make sure you are logged in as an Administrator.`)
        } finally {
            setLoading(false)
        }
    }

    async function loadUsers() {
        try {
            setUsersLoading(true)
            const session = await fetchAuthSession()
            const cognitoClient = new CognitoIdentityProviderClient({
                region: 'us-east-1',
                credentials: session.credentials
            })
            
            const userPoolId = 'us-east-1_GrxwbZK9I'
            
            // Get all users from Cognito
            const listUsersResult = await cognitoClient.send(new ListUsersCommand({
                UserPoolId: userPoolId,
                Limit: 60
            }))
            
            // Get UserProfiles to match with Cognito users
            const userProfiles = await client.models.UserProfile.list({ limit: QUERY_LIMITS.USER_PROFILES_LIMIT })
            
            // Combine Cognito user data with UserProfile data and get groups
            const usersWithProfiles = await Promise.all(listUsersResult.Users?.map(async cognitoUser => {
                const email = cognitoUser.Attributes?.find(attr => attr.Name === 'email')?.Value
                const sub = cognitoUser.Attributes?.find(attr => attr.Name === 'sub')?.Value
                const profile = userProfiles.data.find(p => p.sub === sub)
                
                // Get user's groups - try with Username first, then email
                let groups: string[] = []
                try {
                    const groupsResult = await cognitoClient.send(new AdminListGroupsForUserCommand({
                        UserPoolId: userPoolId,
                        Username: cognitoUser.Username!
                    }))
                    groups = groupsResult.Groups?.map(g => g.GroupName!) || []
                } catch (error) {
                    // If Username fails, try with email
                    if (email) {
                        try {
                            const groupsResult = await cognitoClient.send(new AdminListGroupsForUserCommand({
                                UserPoolId: userPoolId,
                                Username: email
                            }))
                            groups = groupsResult.Groups?.map(g => g.GroupName!) || []
                        } catch (emailError) {
                            console.error(`Failed to get groups for user ${email}:`, emailError)
                        }
                    } else {
                        console.error(`Failed to get groups for user ${cognitoUser.Username}:`, error)
                    }
                }
                
                // Determine the highest role (Administrator > Organizer > Canvasser > Member)
                let role = 'Member'
                if (groups.includes('Administrator')) role = 'Administrator'
                else if (groups.includes('Organizer')) role = 'Organizer'
                else if (groups.includes('Canvasser')) role = 'Canvasser'
                
                // If no groups found but we have a roleCache, use that as fallback
                if (groups.length === 0 && profile?.roleCache) {
                    role = profile.roleCache
                }
                
                return {
                    ...cognitoUser,
                    email: email,
                    sub: sub,
                    profile: profile,
                    enabled: cognitoUser.Enabled,
                    status: cognitoUser.UserStatus,
                    created: cognitoUser.UserCreateDate,
                    groups: groups,
                    role: role
                }
            }) || [])
            
            setUsers(usersWithProfiles)
        } catch (error) {
            console.error('Failed to load users:', error)
            alert('Failed to load users')
        } finally {
            setUsersLoading(false)
        }
    }

    async function handleRoleChange(user: any, newRole: string) {
        if (!user.email) {
            alert('Cannot change role for user without email')
            return
        }
        
        if (user.email === currentUserEmail) {
            alert('You cannot change your own role')
            return
        }
        
        try {
            const session = await fetchAuthSession()
            const cognitoClient = new CognitoIdentityProviderClient({
                region: 'us-east-1',
                credentials: session.credentials
            })
            
            const userPoolId = 'us-east-1_GrxwbZK9I'
            const allRoles = ['Administrator', 'Organizer', 'Canvasser', 'Member']
            
            // Remove user from all groups first
            for (const role of user.groups || []) {
                try {
                    await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
                        UserPoolId: userPoolId,
                        Username: user.email,
                        GroupName: role
                    }))
                } catch (error) {
                    console.error(`Failed to remove user from group ${role}:`, error)
                }
            }
            
            // Add user to new group
            await cognitoClient.send(new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: user.email,
                GroupName: newRole
            }))
            
            // Update UserProfile roleCache if it exists
            if (user.profile?.id) {
                await client.models.UserProfile.update({
                    id: user.profile.id,
                    roleCache: newRole
                })
            }
            
            // Update local state
            setUsers(prev => prev.map(u => 
                u.email === user.email 
                    ? {...u, role: newRole, groups: [newRole]} 
                    : u
            ))
            
            alert(`${user.email}'s role has been changed to ${newRole}`)
        } catch (error) {
            console.error('Failed to change user role:', error)
            alert(`Failed to change user role: ${error.message}`)
        }
    }

    async function handleDeleteUser(user: any) {
        if (!user.email) {
            alert('Cannot delete user without email')
            return
        }
        
        if (user.email === currentUserEmail) {
            alert('You cannot delete your own account')
            return
        }
        
        if (!confirm(`Are you sure you want to permanently delete user ${user.email}? This will completely remove their account and they will be able to re-register fresh.`)) {
            return
        }

        try {
            const session = await fetchAuthSession()
            const cognitoClient = new CognitoIdentityProviderClient({
                region: 'us-east-1',
                credentials: session.credentials
            })
            
            const userPoolId = 'us-east-1_GrxwbZK9I'
            
            // Delete from Cognito
            await cognitoClient.send(new AdminDeleteUserCommand({
                UserPoolId: userPoolId,
                Username: user.email
            }))
            
            // Delete UserProfile if it exists
            if (user.profile?.id) {
                await client.models.UserProfile.delete({
                    id: user.profile.id
                })
            }
            
            // Remove from local state
            setUsers(prev => prev.filter(u => u.email !== user.email))
            
            alert(`User ${user.email} has been successfully deleted`)
        } catch (error) {
            console.error('Failed to delete user:', error)
            alert(`Failed to delete user: ${error.message}`)
        }
    }

    async function handleAccept(registration: any) {
        try {
            // Get the selected role for this registration, default to Member
            const selectedRole = selectedRoles[registration.id] || 'Member'
            
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
            
            let userSub: string | undefined
            let userAlreadyExists = false
            
            // First, check if user already exists
            try {
                const existingUser = await cognitoClient.send(new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: registration.email
                }))
                
                userSub = existingUser.UserAttributes?.find(attr => attr.Name === 'sub')?.Value
                userAlreadyExists = true
                
                // If user exists, make sure they're in the selected group
                await cognitoClient.send(new AdminAddUserToGroupCommand({
                    UserPoolId: userPoolId,
                    Username: registration.email,
                    GroupName: selectedRole
                })).catch(err => {
                    // Group assignment might fail if already in group, that's ok
                })
                
            } catch (userNotFoundError: any) {
                if (userNotFoundError.name === 'UserNotFoundException') {
                    // User doesn't exist, create them
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
                    
                    userSub = createUserResult.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value
                    
                    // Add new user to selected group
                    await cognitoClient.send(new AdminAddUserToGroupCommand({
                        UserPoolId: userPoolId,
                        Username: registration.email,
                        GroupName: selectedRole
                    }))
                } else {
                    throw userNotFoundError
                }
            }
            
            if (!userSub) {
                throw new Error('Failed to get user sub from created user')
            }
            
            // Update registration status
            await client.models.Registration.update({
                id: registration.id,
                status: 'ACCEPTED'
            })
            
            // Check if UserProfile already exists for this user
            const existingProfiles = await client.models.UserProfile.list({
                filter: { sub: { eq: userSub } }
            })
            
            if (existingProfiles.data.length > 0) {
                // Update existing profile
                await client.models.UserProfile.update({
                    id: existingProfiles.data[0].id,
                    email: registration.email,
                    firstName: registration.firstName,
                    lastName: registration.lastName,
                    street: registration.street,
                    mobile: registration.mobile,
                    roleCache: selectedRole
                })
            } else {
                // Create new profile
                await client.models.UserProfile.create({
                    sub: userSub,
                    email: registration.email,
                    firstName: registration.firstName,
                    lastName: registration.lastName,
                    street: registration.street,
                    mobile: registration.mobile,
                    roleCache: selectedRole
                })
            }

            // Send welcome email with login credentials using notify-admins function
            let emailSent = false
            let emailError = null
            try {
                
                const functionUrl = 'https://iztw3vy5oc7pxbe2fqlvtqchne0hzfcn.lambda-url.us-east-1.on.aws/'
                const welcomeResponse = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'sendWelcomeEmail',
                        email: registration.email,
                        firstName: registration.firstName,
                        lastName: registration.lastName,
                        tempPassword: tempPassword
                    })
                })
                
                const responseText = await welcomeResponse.text()
                
                if (welcomeResponse.ok) {
                    emailSent = true
                } else {
                    // Check if it's a verification error
                    if (responseText.includes('Email address is not verified')) {
                        emailError = 'unverified'
                    }
                }
            } catch (error) {
                emailError = 'failed'
            }

            setRegistrations(prev => prev.filter(r => r.id !== registration.id))
            
            // Build the appropriate success message based on what happened
            let message = `${registration.firstName} ${registration.lastName} has been accepted!\n\n`
            
            if (userAlreadyExists) {
                message += `✅ User account already existed\n`
            } else {
                message += `✅ Cognito user account created successfully\n`
            }
            
            message += `✅ Added to ${selectedRole} group\n`
            message += `✅ User profile ${existingProfiles.data.length > 0 ? 'updated' : 'created'}\n`
            
            if (emailSent) {
                message += `✅ Welcome email sent with login credentials\n\n`
                message += `The user will receive an email at ${registration.email} with their login credentials and instructions.`
                alert(message)
            } else if (emailError === 'unverified' || emailError === 'failed') {
                // For failed emails, copy credentials to clipboard and show in a prompt
                const credentials = `Login Credentials for ${registration.firstName} ${registration.lastName}:
Email: ${registration.email}
Temporary Password: ${tempPassword}
Login URL: ${window.location.origin}/landing

Note: The user will be required to change their password on first login.`
                
                // Try to copy to clipboard
                try {
                    await navigator.clipboard.writeText(credentials)
                    message += `⚠️ Welcome email could not be sent${emailError === 'unverified' ? ' (recipient email not verified in AWS SES)' : ''}\n\n`
                    message += `✅ Login credentials have been copied to your clipboard!\n\n`
                    message += `Paste them into an email to send to the user.`
                    alert(message)
                } catch (clipboardError) {
                    // If clipboard fails, use prompt so user can copy manually
                    message += `⚠️ Welcome email could not be sent${emailError === 'unverified' ? ' (recipient email not verified in AWS SES)' : ''}\n\n`
                    message += `Please copy the credentials from the next dialog.`
                    alert(message)
                    
                    // Show credentials in a prompt dialog where text can be selected
                    prompt('Copy these login credentials to send to the user:', credentials)
                }
            }
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
                                            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                                <select 
                                                    value={selectedRoles[reg.id] || 'Member'}
                                                    onChange={(e) => setSelectedRoles(prev => ({...prev, [reg.id]: e.target.value}))}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: 4,
                                                        border: '1px solid #ddd',
                                                        fontSize: '0.9em'
                                                    }}
                                                >
                                                    <option value="Member">Member</option>
                                                    <option value="Canvasser">Canvasser</option>
                                                    <option value="Organizer">Organizer</option>
                                                    <option value="Administrator">Administrator</option>
                                                </select>
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

                {/* User Management Section */}
                <div style={{marginTop: 48, borderTop: '2px solid #e9ecef', paddingTop: 24}}>
                    <h2>User Management</h2>
                    <p>Manage existing user accounts. You can delete users to completely remove their access.</p>
                    
                    {usersLoading ? (
                        <p>Loading users...</p>
                    ) : (
                        <div style={{overflowX: 'auto'}}>
                            <table style={{width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd'}}>
                                <thead>
                                    <tr style={{backgroundColor: '#f5f5f5'}}>
                                        <th style={{padding: 12, border: '1px solid #ddd', textAlign: 'left'}}>Email</th>
                                        <th style={{padding: 12, border: '1px solid #ddd', textAlign: 'left'}}>Name</th>
                                        <th style={{padding: 12, border: '1px solid #ddd', textAlign: 'left'}}>Role</th>
                                        <th style={{padding: 12, border: '1px solid #ddd', textAlign: 'left'}}>Status</th>
                                        <th style={{padding: 12, border: '1px solid #ddd', textAlign: 'left'}}>Created</th>
                                        <th style={{padding: 12, border: '1px solid #ddd', textAlign: 'left'}}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.sub} style={{
                                            backgroundColor: user.email === currentUserEmail ? '#fff3cd' : 'transparent'
                                        }}>
                                            <td style={{padding: 12, border: '1px solid #ddd'}}>
                                                {user.email}
                                                {user.email === currentUserEmail && <span style={{color: '#856404', fontSize: '0.8em'}}> (You)</span>}
                                            </td>
                                            <td style={{padding: 12, border: '1px solid #ddd'}}>
                                                {user.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : '-'}
                                            </td>
                                            <td style={{padding: 12, border: '1px solid #ddd'}}>
                                                <select 
                                                    value={user.role || 'Member'}
                                                    onChange={(e) => handleRoleChange(user, e.target.value)}
                                                    disabled={user.email === currentUserEmail}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: 4,
                                                        border: '1px solid #ddd',
                                                        backgroundColor: user.email === currentUserEmail ? '#f5f5f5' : 'white',
                                                        cursor: user.email === currentUserEmail ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.9em'
                                                    }}
                                                >
                                                    <option value="Member">Member</option>
                                                    <option value="Canvasser">Canvasser</option>
                                                    <option value="Organizer">Organizer</option>
                                                    <option value="Administrator">Administrator</option>
                                                </select>
                                            </td>
                                            <td style={{padding: 12, border: '1px solid #ddd'}}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    fontSize: '0.8em',
                                                    backgroundColor: user.enabled ? '#d4edda' : '#f8d7da',
                                                    color: user.enabled ? '#155724' : '#721c24'
                                                }}>
                                                    {user.enabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td style={{padding: 12, border: '1px solid #ddd', fontSize: 14}}>
                                                {user.created ? new Date(user.created).toLocaleDateString() : '-'}
                                            </td>
                                            <td style={{padding: 12, border: '1px solid #ddd'}}>
                                                <button 
                                                    onClick={() => handleDeleteUser(user)}
                                                    disabled={user.email === currentUserEmail}
                                                    style={{
                                                        backgroundColor: user.email === currentUserEmail ? '#6c757d' : '#dc3545', 
                                                        color: 'white', 
                                                        border: 'none', 
                                                        padding: '4px 8px', 
                                                        borderRadius: 4, 
                                                        cursor: user.email === currentUserEmail ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.9em',
                                                        opacity: user.email === currentUserEmail ? 0.6 : 1
                                                    }}
                                                >
                                                    Delete User
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            {users.length === 0 && (
                                <p style={{textAlign: 'center', padding: 20, color: '#666'}}>No users found</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
