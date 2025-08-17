import {
    SESClient,
    SendEmailCommand
} from '@aws-sdk/client-ses'
import { APP_CONFIG } from '../../shared/config'

export const handler = async (event: any) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Max-Age': '86400'
    }
    
    console.log('Received event:', JSON.stringify(event, null, 2))
    
    // Handle preflight OPTIONS request manually
    if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request')
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        }
    }
    
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {})
        const {email, firstName, lastName, tempPassword} = body
        
        if (!email || !firstName || !lastName || !tempPassword) {
            return {
                statusCode: 400, 
                headers: corsHeaders, 
                body: JSON.stringify({error: 'Missing required data'})
            }
        }
        
        // Send welcome email using SES
        const sesClient = new SESClient({})
        
        const fromEmail = process.env.FROM_EMAIL || 'mike@michael-simpson.com'
        
        const emailSubject = `Welcome to SWHOA Dissolution Campaign - Account Created`
        const emailBody = `
Dear ${firstName} ${lastName},

Welcome to the SWHOA dissolution campaign! Your account has been approved and created.

Login Details:
• Website: https://${process.env.APP_DOMAIN || APP_CONFIG.DOMAIN}
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
            headers: corsHeaders, 
            body: JSON.stringify({
                message: `Welcome email sent to ${email}`,
                email: email
            })
        }
        
    } catch (error: any) {
        console.error('Error sending welcome email:', error)
        return {
            statusCode: 500, 
            headers: corsHeaders, 
            body: JSON.stringify({
                error: 'Failed to send welcome email',
                message: error.message
            })
        }
    }
}