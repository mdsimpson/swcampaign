import {defineBackend} from '@aws-amplify/backend'
import {auth} from './auth/resource'
import {data} from './data/resource'
import {adminApi} from './functions/admin-api/resource'
import {notifyAdmins} from './functions/notify-admins/resource'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'

export const backend = defineBackend({auth, data, adminApi, notifyAdmins})

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

// Grant notifyAdmins function permissions to read Cognito users and send emails
backend.notifyAdmins.addToRolePolicy(new PolicyStatement({
  actions: [
    "cognito-idp:ListUsersInGroup",
    "ses:SendEmail",
    "ses:SendRawEmail"
  ],
  resources: [
    backend.auth.resources.userPool.userPoolArn,
    "*" // SES resources
  ]
}))
