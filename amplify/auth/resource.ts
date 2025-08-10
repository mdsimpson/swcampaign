import { defineAuth } from '@aws-amplify/backend'
export const auth = defineAuth({
    loginWith: { email: true },
    // Note: Using Cognito built-in verification + forgot password flows.
    // If you want link-style emails, we can add a Custom Message trigger in a follow-up.
})
