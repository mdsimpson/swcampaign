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

    Address: a.model({
        externalId: a.string(), // Original ID from CSV
        street: a.string().required(),
        city: a.string().required(),
        state: a.string().default('VA'),
        zip: a.string(),
        lat: a.float(),
        lng: a.float(),
        notes: a.string(),
        residents: a.hasMany('Resident','addressId'),
        assignments: a.hasMany('Assignment','addressId'),
        interactions: a.hasMany('InteractionRecord','addressId'),
        consents: a.hasMany('Consent','addressId'),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read','update']),
        allow.groups(['Member']).to(['read']),
        allow.publicApiKey().to(['create','read','update','delete']) // Allow import scripts and bulk operations
    ]),

    Resident: a.model({
        personId: a.string(), // Person ID from CSV (person_id column)
        externalId: a.string(), // Original ID from CSV (deprecated)
        addressId: a.id().required(),
        address: a.belongsTo('Address','addressId'),
        firstName: a.string(),
        lastName: a.string(),
        occupantType: a.string(), // e.g., "Official Owner", "Official Co Owner"
        contactEmail: a.string(),
        additionalEmail: a.string(),
        cellPhone: a.string(),
        cellPhoneAlert: a.string(),
        unitPhone: a.string(),
        workPhone: a.string(),
        isAbsentee: a.boolean().default(false),
        hasSigned: a.boolean().default(false),
        signedAt: a.datetime(),
        consent: a.hasOne('Consent','residentId'), // Changed to hasOne - each resident can only sign once
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read','update']),
        allow.groups(['Member']).to(['read']),
        allow.publicApiKey().to(['create','read','update','delete']) // Allow import scripts, bulk operations, and consent uploads
    ]),

    Consent: a.model({
        residentId: a.id().required(),
        resident: a.belongsTo('Resident','residentId'),
        addressId: a.id().required(),
        address: a.belongsTo('Address','addressId'),
        recordedBy: a.string(),
        recordedAt: a.datetime().required(),
        source: a.string(), // manual | bulk-upload | csv-upload
        email: a.string(), // Email from consent CSV upload (resident_email or expanded_email)
    }).authorization(allow => [
        allow.groups(['Administrator']).to(['create','read','update','delete']),
        allow.groups(['Organizer']).to(['read']),
        allow.publicApiKey().to(['create','read']) // Allow bulk import scripts
    ]),

    Volunteer: a.model({
        userSub: a.string().required(),
        displayName: a.string(),
        email: a.string(),
        assignments: a.hasMany('Assignment','volunteerId'),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['read']),  // Allow canvassers to read volunteer records
        allow.owner().to(['read']),
        allow.publicApiKey().to(['create','read']) // Allow import scripts and testing
    ]),

    Assignment: a.model({
        addressId: a.id().required(),
        address: a.belongsTo('Address','addressId'),
        volunteerId: a.id().required(),
        volunteer: a.belongsTo('Volunteer','volunteerId'),
        assignedAt: a.datetime(),
        status: a.enum(['NOT_STARTED','IN_PROGRESS','DONE','DEFERRED']),
        lastContactAt: a.datetime(),
        notes: a.string(),
    }).authorization(allow => [
        allow.groups(['Administrator','Organizer']).to(['create','read','update','delete']),
        allow.groups(['Canvasser']).to(['create','read','update']),
        allow.publicApiKey().to(['create','read']) // Allow import scripts and testing
    ]),

    InteractionRecord: a.model({
        addressId: a.id().required(),
        address: a.belongsTo('Address','addressId'),
        participantResidentIds: a.string(), // CSV of Resident IDs (or names if Other)
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
        allow.publicApiKey().to(['create','read']) // Temporary: Allow interaction creation while debugging auth
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
