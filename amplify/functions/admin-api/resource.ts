import {defineFunction} from '@aws-amplify/backend'

export const adminApi = defineFunction({
  name: 'admin-api', 
  entry: './handler.ts', 
  environment: {
    ALLOWED_ORIGINS: '*',
    FROM_EMAIL: process.env.FROM_EMAIL || 'mike@michael-simpson.com' // Environment variable with fallback
  },
  runtime: 20
})
