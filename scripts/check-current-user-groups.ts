// Check what groups the current Cognito user is in
import { CognitoIdentityProviderClient, GetUserCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider'
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

Amplify.configure(outputs)

const USER_POOL_ID = 'us-east-1_kAw9CKPT3'  // Production User Pool ID

async function main() {
    try {
        // Get current user
        const user = await getCurrentUser()
        console.log('Current user:', user.username)
        console.log('User sub:', user.userId)
        console.log('')

        // Get session with credentials
        const session = await fetchAuthSession()

        const cognitoClient = new CognitoIdentityProviderClient({
            region: 'us-east-1',
            credentials: session.credentials
        })

        // Get user's groups
        const groupsResult = await cognitoClient.send(new AdminListGroupsForUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: user.username
        }))

        console.log('User groups:')
        if (groupsResult.Groups && groupsResult.Groups.length > 0) {
            groupsResult.Groups.forEach(group => {
                console.log(`  - ${group.GroupName}`)
            })
        } else {
            console.log('  ⚠️  NO GROUPS ASSIGNED!')
            console.log('  This user cannot access Address/Resident data.')
            console.log('  Add user to: Administrator, Organizer, Canvasser, or Member group')
        }
    } catch (err) {
        console.error('Error:', err)
    }
}

main()
