import {defineBackend} from '@aws-amplify/backend'
import {auth} from './auth/resource'
import {data} from './data/resource'
import {adminApi} from './functions/admin-api/resource'

export const backend = defineBackend({auth, data, adminApi})
