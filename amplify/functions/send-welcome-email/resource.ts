import {defineFunction} from '@aws-amplify/backend'

export const sendWelcomeEmail = defineFunction({
  name: 'send-welcome-email', 
  entry: './handler.ts', 
  environment: {
    ALLOWED_ORIGINS: '*',
    FROM_EMAIL: 'mike@michael-simpson.com',
    APP_URL: 'https://your-app-domain.com' // TODO: Replace with your app's URL
  },
  runtime: 20
})