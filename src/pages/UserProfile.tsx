import Header from '../components/Header'
import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'

export default function UserProfile() {
    const [userProfile, setUserProfile] = useState<any>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        street: '',
        mobile: ''
    })
    const [saving, setSaving] = useState(false)
    
    const client = generateClient<Schema>()

    useEffect(() => {
        loadUserProfile()
    }, [])

    async function loadUserProfile() {
        try {
            setLoading(true)
            
            // Get current user info from Cognito
            const user = await getCurrentUser()
            console.log('Current user:', user)
            const userEmail = user.signInDetails?.loginId || user.username
            console.log('User email:', userEmail)
            console.log('User username:', user.username)
            setCurrentUser(user)
            
            // Get auth session to get user sub
            const session = await fetchAuthSession()
            const userSub = session.userSub
            console.log('User sub:', userSub)
            
            if (!userSub) {
                throw new Error('Unable to get user ID')
            }
            
            // Find user profile by sub
            console.log('Querying UserProfile with sub:', userSub)
            const profiles = await client.models.UserProfile.list({
                filter: { sub: { eq: userSub } }
            })
            console.log('Found profiles:', profiles.data)
            const profile = profiles.data[0]
            
            if (profile) {
                console.log('Profile found:', profile)
                console.log('Profile email field:', profile.email)
                console.log('User sub:', userSub)
                console.log('User email:', userEmail)
                console.log('Does email equal sub?', profile.email === userSub)
                console.log('Does email equal userEmail?', profile.email === userEmail)
                
                // Check if the email field contains the sub instead of email (data corruption fix)
                if (profile.email === userSub && profile.email !== userEmail) {
                    console.log('Fixing corrupted email field in profile...')
                    const updatedProfile = await client.models.UserProfile.update({
                        id: profile.id,
                        email: userEmail
                    })
                    console.log('Fixed profile email:', updatedProfile.data)
                    setUserProfile(updatedProfile.data)
                } else {
                    console.log('Email field appears correct, no fix needed')
                    setUserProfile(profile)
                }
                
                setEditForm({
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    street: profile.street || '',
                    mobile: profile.mobile || ''
                })
            } else {
                console.log('No profile found, creating new one...')
                // Create a basic user profile if it doesn't exist, using attributes from Cognito
                const firstName = user.attributes?.given_name || ''
                const lastName = user.attributes?.family_name || ''
                const street = user.attributes?.address || ''
                const mobile = user.attributes?.phone_number || ''
                
                // Determine role - if user is in Administrator group, set as Administrator
                let roleCache = 'Member' // default
                try {
                    const session = await fetchAuthSession()
                    const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || []
                    if (groups.includes('Administrator')) {
                        roleCache = 'Administrator'
                    } else if (groups.includes('Organizer')) {
                        roleCache = 'Organizer'
                    } else if (groups.includes('Canvasser')) {
                        roleCache = 'Canvasser'
                    }
                } catch (groupError) {
                    console.warn('Could not determine user groups:', groupError)
                }
                
                console.log('Creating profile with role:', roleCache)
                const newProfile = await client.models.UserProfile.create({
                    sub: userSub,
                    email: userEmail,
                    firstName: firstName,
                    lastName: lastName,
                    street: street,
                    mobile: mobile,
                    roleCache: roleCache
                })
                console.log('Created new profile:', newProfile.data)
                setUserProfile(newProfile.data)
                setEditForm({
                    firstName: firstName,
                    lastName: lastName,
                    street: street,
                    mobile: mobile
                })
            }
            
        } catch (error) {
            console.error('Failed to load user profile:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        if (!userProfile) return
        
        try {
            setSaving(true)
            
            const updatedProfile = await client.models.UserProfile.update({
                id: userProfile.id,
                firstName: editForm.firstName.trim(),
                lastName: editForm.lastName.trim(),
                street: editForm.street.trim(),
                mobile: editForm.mobile.trim()
            })
            
            setUserProfile(updatedProfile.data)
            setEditing(false)
            alert('Profile updated successfully!')
            
        } catch (error) {
            console.error('Failed to update profile:', error)
            alert('Failed to update profile. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    function handleCancel() {
        setEditForm({
            firstName: userProfile?.firstName || '',
            lastName: userProfile?.lastName || '',
            street: userProfile?.street || '',
            mobile: userProfile?.mobile || ''
        })
        setEditing(false)
    }

    function getRoleDisplayName(role: string) {
        switch (role) {
            case 'Administrator': return 'Administrator'
            case 'Organizer': return 'Organizer'
            case 'Canvasser': return 'Canvasser'
            case 'Member': return 'Member'
            default: return role || 'Unknown'
        }
    }

    if (loading) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 700, margin: '20px auto', padding: 16}}>
                    <h2>User Profile</h2>
                    <p>Loading your profile...</p>
                </div>
            </div>
        )
    }

    if (!userProfile) {
        return (
            <div>
                <Header/>
                <div style={{maxWidth: 700, margin: '20px auto', padding: 16}}>
                    <h2>User Profile</h2>
                    <p>Unable to load user profile. Please try refreshing the page.</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 700, margin: '20px auto', padding: 16}}>
                <h2>User Profile</h2>
                
                {/* Account Information */}
                <div style={{
                    backgroundColor: '#f8f9fa', 
                    padding: 16, 
                    borderRadius: 8, 
                    marginBottom: 24,
                    border: '1px solid #e9ecef'
                }}>
                    <h3 style={{marginTop: 0, marginBottom: 16}}>Account Information</h3>
                    <div style={{display: 'grid', gap: 12}}>
                        <div>
                            <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                Email Address
                            </label>
                            <span style={{color: '#666'}}>{userProfile.email}</span>
                        </div>
                        <div>
                            <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                Role
                            </label>
                            <span style={{
                                color: '#007bff',
                                backgroundColor: '#e3f2fd',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: '0.9em'
                            }}>
                                {getRoleDisplayName(userProfile.roleCache)}
                            </span>
                        </div>
                        <div>
                            <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                Member Since
                            </label>
                            <span style={{color: '#666'}}>
                                {new Date(userProfile.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Personal Information */}
                <div style={{
                    backgroundColor: '#fff', 
                    padding: 16, 
                    borderRadius: 8, 
                    marginBottom: 24,
                    border: '1px solid #e9ecef'
                }}>
                    <div style={{
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 16
                    }}>
                        <h3 style={{margin: 0}}>Personal Information</h3>
                        {!editing && (
                            <button
                                onClick={() => setEditing(true)}
                                style={{
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Edit Profile
                            </button>
                        )}
                    </div>
                    
                    {editing ? (
                        <div style={{display: 'grid', gap: 16}}>
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    First Name
                                </label>
                                <input
                                    type="text"
                                    value={editForm.firstName}
                                    onChange={e => setEditForm({...editForm, firstName: e.target.value})}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 4,
                                        border: '1px solid #ccc',
                                        fontSize: '1em'
                                    }}
                                    placeholder="Enter your first name"
                                />
                            </div>
                            
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    Last Name
                                </label>
                                <input
                                    type="text"
                                    value={editForm.lastName}
                                    onChange={e => setEditForm({...editForm, lastName: e.target.value})}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 4,
                                        border: '1px solid #ccc',
                                        fontSize: '1em'
                                    }}
                                    placeholder="Enter your last name"
                                />
                            </div>
                            
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    Street Address
                                </label>
                                <input
                                    type="text"
                                    value={editForm.street}
                                    onChange={e => setEditForm({...editForm, street: e.target.value})}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 4,
                                        border: '1px solid #ccc',
                                        fontSize: '1em'
                                    }}
                                    placeholder="Enter your street address"
                                />
                            </div>
                            
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    Mobile Phone
                                </label>
                                <input
                                    type="tel"
                                    value={editForm.mobile}
                                    onChange={e => setEditForm({...editForm, mobile: e.target.value})}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 4,
                                        border: '1px solid #ccc',
                                        fontSize: '1em'
                                    }}
                                    placeholder="Enter your mobile phone number"
                                />
                            </div>
                            
                            <div style={{display: 'flex', gap: 12, marginTop: 8}}>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px 20px',
                                        borderRadius: 4,
                                        cursor: saving ? 'default' : 'pointer',
                                        opacity: saving ? 0.6 : 1
                                    }}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    style={{
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px 20px',
                                        borderRadius: 4,
                                        cursor: saving ? 'default' : 'pointer',
                                        opacity: saving ? 0.6 : 1
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{display: 'grid', gap: 16}}>
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    First Name
                                </label>
                                <span style={{color: '#666'}}>
                                    {userProfile.firstName || <em style={{color: '#999'}}>Not provided</em>}
                                </span>
                            </div>
                            
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    Last Name
                                </label>
                                <span style={{color: '#666'}}>
                                    {userProfile.lastName || <em style={{color: '#999'}}>Not provided</em>}
                                </span>
                            </div>
                            
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    Street Address
                                </label>
                                <span style={{color: '#666'}}>
                                    {userProfile.street || <em style={{color: '#999'}}>Not provided</em>}
                                </span>
                            </div>
                            
                            <div>
                                <label style={{fontWeight: 'bold', display: 'block', marginBottom: 4}}>
                                    Mobile Phone
                                </label>
                                <span style={{color: '#666'}}>
                                    {userProfile.mobile || <em style={{color: '#999'}}>Not provided</em>}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Password Management */}
                <div style={{
                    backgroundColor: '#fff3cd', 
                    padding: 16, 
                    borderRadius: 8, 
                    border: '1px solid #ffeaa7'
                }}>
                    <h3 style={{marginTop: 0, marginBottom: 12}}>Password Management</h3>
                    <p style={{marginBottom: 12, fontSize: '0.95em'}}>
                        To change your password or manage your account security, you'll need to use AWS Cognito's interface.
                    </p>
                    <p style={{fontSize: '0.9em', color: '#856404'}}>
                        <strong>Note:</strong> Password changes must be done through the authentication system for security reasons.
                        Contact an administrator if you need assistance with password reset.
                    </p>
                </div>
            </div>
        </div>
    )
}
