import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

const schema = a.schema({
    // Registration record (Admin approval optional via status)
    Registration: a.model({
        email: a.string().required(),
        firstName: a.string().required(),
        lastName: a.string().required(),
        street: a.string().required(),
        mobile: a.string(),
        submittedAt: a.datetime().required(),
        status: a.enum(['SUBMITTED','VERIFIED','ACCEPTED','REJECTED']).default('SUBMITTED'),
        notes: a.string(),
    }).authorization(allow => [
        allow.groups(['Administrator']).to(['read','update','delete']),
        allow.publicApiKey().to(['create']), // Public sign-up form
    ]),

    Home: a.model({
        unitNumber: a.string(),
        street: a.string().required(),
        city: a.string().required(),
        state: a.string().default('VA'),
        postalCode: a.string(),
        mailingStreet: a.string(),
        mailingCity: a.string(),
        mailingState: a.string(),
        mailingPostalCode: a.string(),
        absenteeOwner: a.boolean().default(false),
        lat: a.float(),
        lng: a.float(),
        notes: a.string(),
        residents: a.hasMany('Person','homeId'),
        assignments: a.hasMany('Assignment','homeId'),
        interactions: a.hasMany('InteractionRecord','homeId'),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read','update']),
        allow.groups(['Member']).to(['read'])
    ]),

    Person: a.model({
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
        role: a.enum(['PRIMARY_OWNER','SECONDARY_OWNER','RENTER','OTHER']).required(),
        firstName: a.string(),
        lastName: a.string(),
        email: a.string(),
        mobilePhone: a.string(),
        hasVoted: a.boolean().default(false),
        voteChoice: a.enum(['YES','NO','UNKNOWN']).default('UNKNOWN'),
        votedAt: a.datetime(),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read','update']),
        allow.groups(['Member']).to(['read'])
    ]),

    Vote: a.model({
        personId: a.id().required(),
        person: a.belongsTo('Person','personId'),
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
        choice: a.enum(['YES','NO','UNKNOWN']).required(),
        recordedBy: a.string(),
        recordedAt: a.datetime().required(),
        source: a.string(), // manual | bulk-upload
    }).authorization(allow => [
        allow.groups(['Administrator']).to(['create','read','update','delete']),
        allow.groups(['Organizer']).to(['read']),
    ]),

    Volunteer: a.model({
        userSub: a.string().required(),
        displayName: a.string(),
        email: a.string(),
        assignments: a.hasMany('Assignment','volunteerId'),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.owner().to(['read'])
    ]),

    Assignment: a.model({
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
        volunteerId: a.id().required(),
        volunteer: a.belongsTo('Volunteer','volunteerId'),
        assignedAt: a.datetime().default('now()'),
        status: a.enum(['NOT_STARTED','IN_PROGRESS','DONE','DEFERRED']).default('NOT_STARTED'),
        lastContactAt: a.datetime(),
        notes: a.string(),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['create','read','update'])
    ]),

    InteractionRecord: a.model({
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
        participantPersonIds: a.string(), // CSV of Person IDs (or names if Other)
        spokeToHomeowner: a.boolean().default(false),
        spokeToOther: a.boolean().default(false),
        leftFlyer: a.boolean().default(false),
        notes: a.string(),
        lat: a.float(),
        lng: a.float(),
        createdAt: a.datetime().default('now()'),
        createdBy: a.string(), // sub/email
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer','Canvasser']).to(['create','read','update']),
    ]),

    UserProfile: a.model({
        sub: a.string().required(),
        email: a.string(),
        firstName: a.string(),
        lastName: a.string(),
        street: a.string(),
        mobile: a.string(),
        roleCache: a.string(),
    }).authorization(allow => [
        allow.owner().to(['read','update']),
        allow.groups(['Administrator']).to(['read','update','delete'])
    ]),
})

export type Schema = ClientSchema<typeof schema>
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } })

# /amplify/functions/admin-api/resource.ts
import { defineFunction } from '@aws-amplify/backend'
export const adminApi = defineFunction({ name: 'admin-api', entry: './handler.ts', environment: { ALLOWED_ORIGINS: '*' } })

# /amplify/functions/admin-api/handler.ts
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand, AdminDisableUserCommand, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider'
export const handler = async (event:any) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers':'content-type,authorization', 'Access-Control-Allow-Methods':'POST,OPTIONS' }
    if (event.requestContext?.http?.method === 'OPTIONS') return { statusCode: 204, headers }
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
        const { action, username, group, userPoolId } = body
        const client = new CognitoIdentityProviderClient({})
        if (!userPoolId) return { statusCode:400, headers, body:'Missing userPoolId' }
        if (action === 'addToGroup') { await client.send(new AdminAddUserToGroupCommand({ UserPoolId:userPoolId, Username:username, GroupName:group })); return { statusCode:200, headers, body:'OK' } }
        if (action === 'removeFromGroup') { await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId:userPoolId, Username:username, GroupName:group })); return { statusCode:200, headers, body:'OK' } }
        if (action === 'disableUser') { await client.send(new AdminDisableUserCommand({ UserPoolId:userPoolId, Username:username })); return { statusCode:200, headers, body:'OK' } }
        if (action === 'listUsers') { const res = await client.send(new ListUsersCommand({ UserPoolId:userPoolId, Limit:60 })); return { statusCode:200, headers, body: JSON.stringify(res.Users || []) } }
        return { statusCode:400, headers, body:'Unknown action' }
    } catch (e:any) { return { statusCode:500, headers, body: e?.message || 'Server error' } }
}