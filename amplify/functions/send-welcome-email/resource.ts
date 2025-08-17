import {defineFunction} from '@aws-amplify/backend'

export const sendWelcomeEmail = defineFunction({
  name: 'send-welcome-email', 
  entry: './handler.ts', 
  environment: {
    ALLOWED_ORIGINS: '*',
    FROM_EMAIL: process.env.FROM_EMAIL || 'mike@michael-simpson.com', // Environment variable with fallback
    APP_DOMAIN: process.env.APP_DOMAIN || 'swhoa.michael-simpson.com' // Environment variable with fallback
  },
  runtime: 20
})