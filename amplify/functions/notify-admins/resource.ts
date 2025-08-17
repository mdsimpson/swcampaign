import {defineFunction} from '@aws-amplify/backend'

export const notifyAdmins = defineFunction({
  name: 'notify-admins', 
  entry: './handler.ts', 
  environment: {
    ALLOWED_ORIGINS: '*',
    USER_POOL_ID: process.env.AMPLIFY_AUTH_USERPOOL_ID || '',
    FROM_EMAIL: process.env.FROM_EMAIL || 'mike@michael-simpson.com', // Environment variable with fallback
    APP_DOMAIN: process.env.APP_DOMAIN || 'swhoa.michael-simpson.com' // Environment variable with fallback
  },
  runtime: 20
})