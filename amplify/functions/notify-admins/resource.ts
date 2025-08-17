import {defineFunction} from '@aws-amplify/backend'

export const notifyAdmins = defineFunction({
  name: 'notify-admins', 
  entry: './handler.ts', 
  environment: {
    ALLOWED_ORIGINS: '*',
    USER_POOL_ID: process.env.AMPLIFY_AUTH_USERPOOL_ID || '',
    FROM_EMAIL: 'mike@michael-simpson.com', // Verified SES email
    APP_URL: 'https://your-app-domain.com' // TODO: Replace with your app's URL
  },
  runtime: 20
})