import { useEffect, useState } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useAuthenticator } from '@aws-amplify/ui-react'
import { Navigate } from 'react-router-dom'

interface RoleProtectedRouteProps {
    children: React.ReactNode
    requiredRoles: string[]
    fallback?: string
}

export default function RoleProtectedRoute({ 
    children, 
    requiredRoles, 
    fallback = '/landing' 
}: RoleProtectedRouteProps) {
    const { user } = useAuthenticator()
    const [userGroups, setUserGroups] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function checkUserRoles() {
            if (!user) {
                setLoading(false)
                return
            }

            try {
                const session = await fetchAuthSession()
                const groups = session.tokens?.idToken?.payload['cognito:groups'] || []
                setUserGroups(groups as string[])
            } catch (error) {
                console.error('Failed to fetch user groups:', error)
                setUserGroups([])
            } finally {
                setLoading(false)
            }
        }

        checkUserRoles()
    }, [user])

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px',
                fontSize: '1.1em',
                color: '#666'
            }}>
                Loading...
            </div>
        )
    }

    if (!user) {
        return <Navigate to={fallback} replace />
    }

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some(role => userGroups.includes(role))
    
    if (!hasRequiredRole) {
        return (
            <div style={{
                maxWidth: 600,
                margin: '40px auto',
                padding: 20,
                textAlign: 'center',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: 8
            }}>
                <h2 style={{ color: '#856404' }}>Access Not Authorized</h2>
                <p style={{ color: '#856404', marginBottom: 20 }}>
                    You don't have the required permissions to access this page. 
                    {userGroups.length === 0 ? (
                        ' Your account is pending approval by an administrator.'
                    ) : (
                        ` Required roles: ${requiredRoles.join(', ')}. Your current roles: ${userGroups.join(', ') || 'None'}.`
                    )}
                </p>
                <button 
                    onClick={() => window.history.back()}
                    style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: 4,
                        cursor: 'pointer'
                    }}
                >
                    Go Back
                </button>
            </div>
        )
    }

    return <>{children}</>
}