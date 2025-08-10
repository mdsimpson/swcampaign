import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand,
    AdminDisableUserCommand,
    ListUsersCommand
} from '@aws-sdk/client-cognito-identity-provider'

export const handler = async (event: any) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type,authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }
    if (event.requestContext?.http?.method === 'OPTIONS') return {statusCode: 204, headers}
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
        const {action, username, group, userPoolId} = body
        const client = new CognitoIdentityProviderClient({})
        if (!userPoolId) return {statusCode: 400, headers, body: 'Missing userPoolId'}
        if (action === 'addToGroup') {
            await client.send(new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: username,
                GroupName: group
            }));
            return {statusCode: 200, headers, body: 'OK'}
        }
        if (action === 'removeFromGroup') {
            await client.send(new AdminRemoveUserFromGroupCommand({
                UserPoolId: userPoolId,
                Username: username,
                GroupName: group
            }));
            return {statusCode: 200, headers, body: 'OK'}
        }
        if (action === 'disableUser') {
            await client.send(new AdminDisableUserCommand({UserPoolId: userPoolId, Username: username}));
            return {statusCode: 200, headers, body: 'OK'}
        }
        if (action === 'listUsers') {
            const res = await client.send(new ListUsersCommand({UserPoolId: userPoolId, Limit: 60}));
            return {statusCode: 200, headers, body: JSON.stringify(res.Users || [])}
        }
        return {statusCode: 400, headers, body: 'Unknown action'}
    } catch (e: any) {
        return {statusCode: 500, headers, body: e?.message || 'Server error'}
    }
}
