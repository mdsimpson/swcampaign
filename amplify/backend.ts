import {defineBackend} from '@aws-amplify/backend'
import {auth} from './auth/resource'
import {data} from './data/resource'
import {adminApi} from './functions/admin-api/resource'
import {notifyAdmins} from './functions/notify-admins/resource'
import {sendWelcomeEmail} from './functions/send-welcome-email/resource'
import {PolicyStatement} from 'aws-cdk-lib/aws-iam'

const backend = defineBackend({auth, data, adminApi, notifyAdmins, sendWelcomeEmail})

// Add Function URL to Lambda function for HTTP access
backend.notifyAdmins.resources.lambda.addFunctionUrl({
  authType: 'NONE' // Allow public access (function will handle CORS internally)
})

// Add Function URL to admin API for HTTP access
backend.adminApi.resources.lambda.addFunctionUrl({
  authType: 'NONE' // Allow public access (function will handle CORS internally)
})

// Add Function URL to welcome email Lambda function for HTTP access
backend.sendWelcomeEmail.resources.lambda.addFunctionUrl({
  authType: 'NONE' // Allow public access (function will handle CORS internally)
})

export { backend }

// Grant Administrator group permissions to manage Cognito users directly
backend.auth.resources.groups["Administrator"]?.attachInlinePolicy({
  "cognitoAdminPolicy": new PolicyStatement({
    actions: [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminAddUserToGroup", 
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:ListUsers",
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminDeleteUser"
    ],
    resources: [backend.auth.resources.userPool.userPoolArn]
  })
})

// Grant authenticated user role permission to perform Cognito admin actions
// This adds the permissions directly to the authenticated identity pool role
backend.auth.resources.authenticatedUserIamRole?.addToPolicy(new PolicyStatement({
  actions: [
    "cognito-idp:AdminCreateUser",
    "cognito-idp:AdminAddUserToGroup", 
    "cognito-idp:AdminRemoveUserFromGroup",
    "cognito-idp:AdminDisableUser",
    "cognito-idp:AdminEnableUser",
    "cognito-idp:ListUsers",
    "cognito-idp:AdminGetUser",
    "cognito-idp:AdminDeleteUser"
  ],
  resources: [backend.auth.resources.userPool.userPoolArn]
}))

// Grant notifyAdmins function permissions to read Cognito users and send emails
backend.notifyAdmins.resources.lambda.addToRolePolicy(new PolicyStatement({
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

// Grant sendWelcomeEmail function permissions to send emails
backend.sendWelcomeEmail.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: [
    "ses:SendEmail",
    "ses:SendRawEmail"
  ],
  resources: [
    "*" // SES resources
  ]
}))

// Grant admin API function permissions to send emails (for welcome emails)
backend.adminApi.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: [
    "ses:SendEmail",
    "ses:SendRawEmail"
  ],
  resources: [
    "*" // SES resources
  ]
}))
