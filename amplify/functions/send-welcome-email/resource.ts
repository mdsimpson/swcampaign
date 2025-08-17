import {defineFunction} from '@aws-amplify/backend'

export const sendWelcomeEmail = defineFunction({
  name: 'send-welcome-email', 
  entry: './handler.ts', 
  environment: {
    ALLOWED_ORIGINS: '*',
    FROM_EMAIL: 'mike@michael-simpson.com',
    APP_URL: 'https://swhoa.michael-simpson.com' // Configurable app URL
  },
  runtime: 20
})