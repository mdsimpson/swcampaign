import { CognitoIdentityProviderClient, CreateGroupCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'

async function ensureGroup(client: CognitoIdentityProviderClient, userPoolId: string, groupName: string){
    try { 
        await client.send(new CreateGroupCommand({ UserPoolId: userPoolId, GroupName: groupName })) 
        console.log(`Created group: ${groupName}`)
    } catch (e:any) {
        if (!String(e?.name || e?.message).includes('GroupExistsException')) throw e
        console.log(`Group already exists: ${groupName}`)
    }
}

async function main(){
    const email = 'michael.d.simpson@gmail.com'
    const tempPassword = 'TempPass#2025'
    
    // You'll need to get the production User Pool ID from AWS Amplify Console
    // Go to your AWS Amplify app -> Backend -> Authentication -> View in Cognito
    const PRODUCTION_USER_POOL_ID = process.env.PROD_USER_POOL_ID
    
    if (!PRODUCTION_USER_POOL_ID) {
        console.error(`
Please set the PROD_USER_POOL_ID environment variable with your production User Pool ID.

To find it:
1. Go to AWS Amplify Console
2. Select your app (swcampaign)
3. Go to the Backend tab
4. Click on Authentication
5. Click "View in Cognito"
6. Copy the User Pool ID (format: us-east-1_XXXXXXXXX)

Then run:
PROD_USER_POOL_ID=us-east-1_XXXXXXXXX npm run seed:admin:production
`)
        process.exit(1)
    }
    
    const poolId = PRODUCTION_USER_POOL_ID
    const region = poolId.split('_')[0]
    const client = new CognitoIdentityProviderClient({ region })

    console.log(`Using production User Pool: ${poolId}`)

    // Ensure groups exist
    console.log('\nCreating groups if they don\'t exist...')
    for (const g of ['Administrator','Organizer','Canvasser','Member']){
        await ensureGroup(client, poolId, g)
    }

    // Check if user already exists
    let userExists = false
    try {
        await client.send(new AdminGetUserCommand({
            UserPoolId: poolId,
            Username: email
        }))
        userExists = true
        console.log(`\nUser ${email} already exists in production`)
    } catch (e: any) {
        if (!String(e?.name || e?.message).includes('UserNotFoundException')) throw e
        console.log(`\nUser ${email} does not exist, creating...`)
    }

    // Create or update the user
    if (!userExists) {
        try {
            await client.send(new AdminCreateUserCommand({
                UserPoolId: poolId,
                Username: email,
                TemporaryPassword: tempPassword,
                MessageAction: 'SUPPRESS',
                UserAttributes: [
                    { Name: 'email', Value: email },
                    { Name: 'email_verified', Value: 'true' },
                ],
            }))
            console.log(`Created user: ${email}`)
        } catch (e:any) {
            const msg = String(e?.name || e?.message)
            if (!msg.includes('UsernameExistsException')) throw e
            console.log(`User already exists: ${email}`)
        }

        // Set a permanent password
        await client.send(new AdminSetUserPasswordCommand({ 
            UserPoolId: poolId, 
            Username: email, 
            Password: tempPassword, 
            Permanent: true 
        }))
        console.log(`Set permanent password for user`)
    }

    // Add to Administrator group
    try {
        await client.send(new AdminAddUserToGroupCommand({ 
            UserPoolId: poolId, 
            Username: email, 
            GroupName: 'Administrator' 
        }))
        console.log(`Added ${email} to Administrator group`)
    } catch (e: any) {
        if (String(e?.message).includes('already a member')) {
            console.log(`User is already in Administrator group`)
        } else {
            throw e
        }
    }
    
    console.log(`\n✅ Production admin user ready!`)
    console.log(`Email: ${email}`)
    console.log(`Password: ${tempPassword}`)
    console.log(`Login at: https://swhoa.michael-simpson.com/landing`)
}

main().catch(err => { 
    console.error('Error:', err); 
    process.exit(1) 
})