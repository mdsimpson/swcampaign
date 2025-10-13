import Header from '../components/Header'
import {useEffect, useState} from 'react'
import {generateClient} from 'aws-amplify/data'
import type {Schema} from '../../amplify/data/resource'
import {fetchAuthSession, getCurrentUser} from 'aws-amplify/auth'

interface Member {
    id: string
    email: string
    firstName: string
    lastName: string
    hasLogin: boolean
    isNonEnrolled?: boolean
}

export default function Members() {
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [currentUserSub, setCurrentUserSub] = useState<string>('')

    // Form state for adding non-enrolled members
    const [showAddForm, setShowAddForm] = useState(false)
    const [addForm, setAddForm] = useState({
        firstName: '',
        lastName: '',
        email: ''
    })
    const [formError, setFormError] = useState<string>('')

    const client = generateClient<Schema>()

    useEffect(() => {
        checkUserRole()
        loadMembers()
    }, [])

    async function checkUserRole() {
        try {
            const session = await fetchAuthSession()
            const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || []
            setIsAdmin(groups.includes('Administrator'))

            const user = await getCurrentUser()
            setCurrentUserSub(user.userId)
        } catch (error) {
            console.error('Failed to check user role:', error)
        }
    }

    async function loadMembers() {
        try {
            setLoading(true)

            // Load enrolled members (UserProfile)
            let enrolledMembers: any[] = []
            let nextToken = null

            do {
                const result = await client.models.UserProfile.list({
                    limit: 100,
                    nextToken
                })
                enrolledMembers.push(...result.data)
                nextToken = result.nextToken
            } while (nextToken)

            // Load non-enrolled members
            let nonEnrolledMembers: any[] = []
            let nonEnrolledToken = null

            do {
                const result = await client.models.NonEnrolledMember.list({
                    limit: 100,
                    nextToken: nonEnrolledToken
                })
                nonEnrolledMembers.push(...result.data)
                nonEnrolledToken = result.nextToken
            } while (nonEnrolledToken)

            // Create a set of enrolled emails for quick lookup
            const enrolledEmails = new Set(
                enrolledMembers
                    .map(m => m.email?.toLowerCase().trim())
                    .filter(e => e)
            )

            // Filter out non-enrolled members who are now enrolled
            // and clean up any duplicates in the database
            const filteredNonEnrolled = nonEnrolledMembers.filter(nem => {
                const email = nem.email?.toLowerCase().trim()
                if (email && enrolledEmails.has(email)) {
                    // This person is now enrolled, delete them from non-enrolled list
                    client.models.NonEnrolledMember.delete({ id: nem.id })
                        .catch(err => console.error('Failed to delete non-enrolled member:', err))
                    return false
                }
                return true
            })

            // Combine into single list
            const combinedMembers: Member[] = [
                ...enrolledMembers.map(m => ({
                    id: m.id,
                    email: m.email || '',
                    firstName: m.firstName || '',
                    lastName: m.lastName || '',
                    hasLogin: true,
                    isNonEnrolled: false
                })),
                ...filteredNonEnrolled.map(m => ({
                    id: m.id,
                    email: m.email || '',
                    firstName: m.firstName || '',
                    lastName: m.lastName || '',
                    hasLogin: false,
                    isNonEnrolled: true
                }))
            ]

            // Sort by last name, then first name
            combinedMembers.sort((a, b) => {
                const lastNameCompare = a.lastName.localeCompare(b.lastName)
                if (lastNameCompare !== 0) return lastNameCompare
                return a.firstName.localeCompare(b.firstName)
            })

            setMembers(combinedMembers)

        } catch (error) {
            console.error('Failed to load members:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddNonEnrolled() {
        // Clear any previous errors
        setFormError('')

        if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()) {
            setFormError('Please fill in all fields')
            return
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(addForm.email)) {
            setFormError('Please enter a valid email address')
            return
        }

        // Check if email already exists in either list
        const emailLower = addForm.email.toLowerCase().trim()
        const existingMember = members.find(m => m.email.toLowerCase().trim() === emailLower)
        if (existingMember) {
            setFormError('A member with this email already exists')
            return
        }

        try {
            await client.models.NonEnrolledMember.create({
                email: addForm.email.trim(),
                firstName: addForm.firstName.trim(),
                lastName: addForm.lastName.trim(),
                addedAt: new Date().toISOString(),
                addedBy: currentUserSub
            })

            setAddForm({ firstName: '', lastName: '', email: '' })
            setFormError('')
            setShowAddForm(false)
            loadMembers()
        } catch (error) {
            console.error('Failed to add non-enrolled member:', error)
            setFormError('Failed to add non-enrolled member. Please try again.')
        }
    }

    async function handleDeleteNonEnrolled(id: string) {
        if (!confirm('Are you sure you want to remove this non-enrolled member?')) {
            return
        }

        try {
            await client.models.NonEnrolledMember.delete({ id })
            alert('Non-enrolled member removed successfully!')
            loadMembers()
        } catch (error) {
            console.error('Failed to delete non-enrolled member:', error)
            alert('Failed to remove non-enrolled member')
        }
    }

    const enrolledCount = members.filter(m => m.hasLogin).length
    const nonEnrolledCount = members.filter(m => !m.hasLogin).length

    return (
        <div>
            <Header/>
            <div style={{maxWidth: 1200, margin: '20px auto', padding: 12}}>
                <h2>Members</h2>
                <p>View all enrolled members and manage non-enrolled contacts.</p>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    gap: 16,
                    marginBottom: 16,
                    padding: 16,
                    backgroundColor: '#f8f9fa',
                    borderRadius: 8
                }}>
                    <div>
                        <strong>Enrolled Members:</strong> {enrolledCount}
                    </div>
                    <div>
                        <strong>Non-Enrolled:</strong> {nonEnrolledCount}
                    </div>
                    <div>
                        <strong>Total:</strong> {members.length}
                    </div>
                </div>

                {/* Add Non-Enrolled Member (Admin Only) */}
                {isAdmin && (
                    <div style={{marginBottom: 16}}>
                        {!showAddForm ? (
                            <button
                                onClick={() => setShowAddForm(true)}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: 4,
                                    cursor: 'pointer'
                                }}
                            >
                                Add Non-Enrolled Member
                            </button>
                        ) : (
                            <div style={{
                                backgroundColor: '#f8f9fa',
                                padding: 16,
                                borderRadius: 8,
                                border: '1px solid #ddd'
                            }}>
                                <h3 style={{marginTop: 0}}>Add Non-Enrolled Member</h3>

                                {/* Error Message */}
                                {formError && (
                                    <div style={{
                                        backgroundColor: '#f8d7da',
                                        color: '#721c24',
                                        padding: '12px 16px',
                                        borderRadius: 4,
                                        border: '1px solid #f5c6cb',
                                        marginBottom: 12
                                    }}>
                                        {formError}
                                    </div>
                                )}

                                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end'}}>
                                    <div>
                                        <label style={{display: 'block', marginBottom: 4}}>First Name:</label>
                                        <input
                                            type="text"
                                            value={addForm.firstName}
                                            onChange={(e) => setAddForm({...addForm, firstName: e.target.value})}
                                            placeholder="Enter first name..."
                                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd', width: 200}}
                                        />
                                    </div>
                                    <div>
                                        <label style={{display: 'block', marginBottom: 4}}>Last Name:</label>
                                        <input
                                            type="text"
                                            value={addForm.lastName}
                                            onChange={(e) => setAddForm({...addForm, lastName: e.target.value})}
                                            placeholder="Enter last name..."
                                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd', width: 200}}
                                        />
                                    </div>
                                    <div>
                                        <label style={{display: 'block', marginBottom: 4}}>Email:</label>
                                        <input
                                            type="email"
                                            value={addForm.email}
                                            onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                                            placeholder="Enter email..."
                                            style={{padding: 8, borderRadius: 4, border: '1px solid #ddd', width: 250}}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddNonEnrolled}
                                        style={{
                                            backgroundColor: '#28a745',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: 4,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddForm(false)
                                            setAddForm({ firstName: '', lastName: '', email: '' })
                                            setFormError('')
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
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Members Table */}
                <div style={{overflowX: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr style={{backgroundColor: '#f8f9fa'}}>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Name</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Email</th>
                                <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Status</th>
                                {isAdmin && <th style={{border: '1px solid #ddd', padding: 8, textAlign: 'left'}}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={isAdmin ? 4 : 3} style={{
                                        border: '1px solid #ddd',
                                        padding: 40,
                                        textAlign: 'center',
                                        color: '#666'
                                    }}>
                                        Loading members...
                                    </td>
                                </tr>
                            ) : members.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 4 : 3} style={{
                                        border: '1px solid #ddd',
                                        padding: 40,
                                        textAlign: 'center',
                                        color: '#666'
                                    }}>
                                        No members found.
                                    </td>
                                </tr>
                            ) : members.map(member => (
                                <tr key={member.id}>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {member.firstName} {member.lastName}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        {member.email}
                                    </td>
                                    <td style={{border: '1px solid #ddd', padding: 8}}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            fontSize: '0.85em',
                                            backgroundColor: member.hasLogin ? '#d4edda' : '#fff3cd',
                                            color: member.hasLogin ? '#155724' : '#856404',
                                            border: `1px solid ${member.hasLogin ? '#c3e6cb' : '#ffeaa7'}`
                                        }}>
                                            {member.hasLogin ? 'Has Login' : 'No Login'}
                                        </span>
                                    </td>
                                    {isAdmin && (
                                        <td style={{border: '1px solid #ddd', padding: 8}}>
                                            {member.isNonEnrolled && (
                                                <button
                                                    onClick={() => handleDeleteNonEnrolled(member.id)}
                                                    style={{
                                                        backgroundColor: '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '4px 8px',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        fontSize: '0.8em'
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
