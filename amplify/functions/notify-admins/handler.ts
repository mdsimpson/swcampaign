import {
    CognitoIdentityProviderClient,
    ListUsersInGroupCommand
} from '@aws-sdk/client-cognito-identity-provider'
import {
    SESClient,
    SendEmailCommand
} from '@aws-sdk/client-ses'
import { APP_URL, ADMIN_ENROLLMENT_URL } from '../../shared/config'

export const handler = async (event: any) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type,authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }
    
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return {statusCode: 204, headers}
    }
    
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
        const {firstName, lastName, email, street, mobile, action, tempPassword} = body
        
        // Handle welcome email action
        if (action === 'sendWelcomeEmail') {
            if (!firstName || !lastName || !email || !tempPassword) {
                return {statusCode: 400, headers, body: 'Missing required welcome email data'}
            }
            
            const sesClient = new SESClient({})
            const fromEmail = process.env.FROM_EMAIL || 'mike@michael-simpson.com'
            
            const emailSubject = `Welcome to SWHOA Dissolution Campaign - Account Created`
            const emailBody = `
Dear ${firstName} ${lastName},

Welcome to the SWHOA dissolution campaign! Your account has been approved and created.

Login Details:
• Website: ${process.env.APP_URL || APP_URL}
• Email: ${email}
• Temporary Password: ${tempPassword}

IMPORTANT: You will be required to change your password on your first login for security purposes.

Next Steps:
1. Visit the website and log in with the credentials above
2. Change your temporary password to a secure password of your choice
3. Complete your profile information if needed
4. Start participating in the dissolution campaign

If you have any questions or need assistance, please contact an administrator.

Thank you for joining our campaign!

---
SWHOA Dissolution Campaign Team
            `.trim()
            
            await sesClient.send(new SendEmailCommand({
                Source: fromEmail,
                Destination: {
                    ToAddresses: [email]
                },
                Message: {
                    Subject: {
                        Data: emailSubject,
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Text: {
                            Data: emailBody,
                            Charset: 'UTF-8'
                        }
                    }
                }
            }))
            
            return {
                statusCode: 200, 
                headers, 
                body: JSON.stringify({
                    message: `Welcome email sent to ${email}`,
                    email: email
                })
            }
        }
        
        // Handle admin notification (original functionality)
        if (!firstName || !lastName || !email) {
            return {statusCode: 400, headers, body: 'Missing required registration data'}
        }
        
        const userPoolId = process.env.USER_POOL_ID || 'us-east-1_GrxwbZK9I'
        
        // Get all Administrator users
        const cognitoClient = new CognitoIdentityProviderClient({})
        const adminUsers = await cognitoClient.send(new ListUsersInGroupCommand({
            UserPoolId: userPoolId,
            GroupName: 'Administrator'
        }))
        
        // Extract admin email addresses
        const adminEmails = adminUsers.Users?.map(user => {
            const emailAttr = user.Attributes?.find(attr => attr.Name === 'email')
            return emailAttr?.Value
        }).filter(email => email) as string[]
        
        if (adminEmails.length === 0) {
            console.log('No administrator emails found')
            return {statusCode: 200, headers, body: 'No administrators to notify'}
        }
        
        // Send email notification using SES
        const sesClient = new SESClient({})
        
        const fromEmail = process.env.FROM_EMAIL || 'mike@michael-simpson.com'
        
        const emailSubject = `New SWHOA Volunteer Registration: ${firstName} ${lastName}`
        const emailBody = `
A new user has registered for the SWHOA dissolution campaign:

Name: ${firstName} ${lastName}
Email: ${email}
Street Address: ${street}
Mobile Phone: ${mobile}
Submitted: ${new Date().toLocaleString()}

Please review this registration in the admin panel and approve or reject as appropriate.

Login to review: ${process.env.APP_URL || ADMIN_ENROLLMENT_URL}

---
This is an automated notification from the SWHOA campaign system.
        `.trim()
        
        // Send email to each administrator
        const emailPromises = adminEmails.map(adminEmail => 
            sesClient.send(new SendEmailCommand({
                Source: fromEmail,
                Destination: {
                    ToAddresses: [adminEmail]
                },
                Message: {
                    Subject: {
                        Data: emailSubject,
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Text: {
                            Data: emailBody,
                            Charset: 'UTF-8'
                        }
                    }
                }
            }))
        )
        
        await Promise.all(emailPromises)
        
        return {
            statusCode: 200, 
            headers, 
            body: JSON.stringify({
                message: `Email notifications sent to ${adminEmails.length} administrators`,
                adminEmails: adminEmails
            })
        }
        
    } catch (error: any) {
        console.error('Error sending admin notifications:', error)
        return {
            statusCode: 500, 
            headers, 
            body: JSON.stringify({
                error: 'Failed to send admin notifications',
                message: error.message
            })
        }
    }
}