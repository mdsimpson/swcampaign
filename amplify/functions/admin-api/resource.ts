import { defineFunction } from '@aws-amplify/backend'
export const adminApi = defineFunction({ name: 'admin-api', entry: './handler.ts', environment: { ALLOWED_ORIGINS: '*' } })
