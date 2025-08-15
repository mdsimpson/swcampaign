import {defineBackend} from '@aws-amplify/backend'
import {auth} from './auth/resource'
import {data} from './data/resource'
import {adminApi} from './functions/admin-api/resource'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'

export const backend = defineBackend({auth, data, adminApi})

// Grant Administrator group permissions to manage Cognito users
backend.auth.resources.groups["Administrator"]?.attachInlinePolicy({
  "cognitoAdminPolicy": new PolicyStatement({
    actions: [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminAddUserToGroup", 
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:ListUsers",
      "cognito-idp:AdminGetUser"
    ],
    resources: [backend.auth.resources.userPool.userPoolArn]
  })
})
