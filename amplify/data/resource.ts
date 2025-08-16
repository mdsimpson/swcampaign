import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

const schema = a.schema({
    // Registration record (Admin approval optional via status)
    Registration: a.model({
        email: a.string().required(),
        firstName: a.string().required(),
        lastName: a.string().required(),
        street: a.string().required(),
        mobile: a.string().required(),
        submittedAt: a.datetime().required(),
        status: a.enum(['SUBMITTED','VERIFIED','ACCEPTED','REJECTED']),
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
        consents: a.hasMany('Consent','homeId'),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read','update']),
        allow.groups(['Member']).to(['read']),
        allow.publicApiKey().to(['create','read','update']) // Allow import scripts and coordinate updates
    ]),

    Person: a.model({
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
        role: a.enum(['PRIMARY_OWNER','SECONDARY_OWNER','RENTER','OTHER']),
        firstName: a.string(),
        lastName: a.string(),
        email: a.string(),
        mobilePhone: a.string(),
        hasSigned: a.boolean().default(false),
        signedAt: a.datetime(),
        consents: a.hasMany('Consent','personId'),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read','update']),
        allow.groups(['Member']).to(['read']),
        allow.publicApiKey().to(['create','read']) // Allow import scripts and UI access
    ]),

    Consent: a.model({
        personId: a.id().required(),
        person: a.belongsTo('Person','personId'),
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
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
        allow.groups(['Canvasser']).to(['read']),  // Allow canvassers to read volunteer records
        allow.owner().to(['read'])
    ]),

    Assignment: a.model({
        homeId: a.id().required(),
        home: a.belongsTo('Home','homeId'),
        volunteerId: a.id().required(),
        volunteer: a.belongsTo('Volunteer','volunteerId'),
        assignedAt: a.datetime(),
        status: a.enum(['NOT_STARTED','IN_PROGRESS','DONE','DEFERRED']),
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
        createdAt: a.datetime(),
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
        allow.ownerDefinedIn('sub').to(['read','update']),
        allow.groups(['Administrator']).to(['read','update','delete','create'])
    ]),
})

export type Schema = ClientSchema<typeof schema>
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool', apiKeyAuthorizationMode: { expiresInDays: 30 } } })
