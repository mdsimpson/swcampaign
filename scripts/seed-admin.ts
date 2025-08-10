import fs from 'node:fs'
import { CognitoIdentityProviderClient, CreateGroupCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider'

function usage(){
    console.log('Usage: npm run seed:admin -- <email> <TempPassword>')
}

async function ensureGroup(client: CognitoIdentityProviderClient, userPoolId: string, groupName: string){
    try { await client.send(new CreateGroupCommand({ UserPoolId: userPoolId, GroupName: groupName })) } catch (e:any) {
        if (!String(e?.name || e?.message).includes('GroupExistsException')) throw e
    }
}

async function main(){
    const email = process.argv[2] || 'michael.d.simpson@gmail.com'
    const tempPassword = process.argv[3] || 'TempPass#2025'
    if (!email || !tempPassword) { usage(); process.exit(1) }
    const outputs = JSON.parse(fs.readFileSync('amplify_outputs.json','utf8'))
    const poolId: string | undefined = outputs?.auth?.user_pool_id
    if (!poolId) throw new Error('Could not read auth.user_pool_id from amplify_outputs.json. Run `npm run sandbox` first.')
    const region = poolId.split('_')[0]
    const client = new CognitoIdentityProviderClient({ region })

    // Ensure groups
    for (const g of ['Administrator','Organizer','Canvasser','Member']){
        await ensureGroup(client, poolId, g)
    }

    // Create or upsert the user
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
    } catch (e:any) {
        const msg = String(e?.name || e?.message)
        if (!msg.includes('UsernameExistsException')) throw e
    }

    // Set a permanent password
    await client.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: email, Password: tempPassword, Permanent: true }))
    // Add to Administrator group
    await client.send(new AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: email, GroupName: 'Administrator' }))
    console.log(`Admin user ensured for ${email} in ${poolId} (${region}).`)
}

main().catch(err => { console.error(err); process.exit(1) })
