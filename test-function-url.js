// Test script to find the correct function URL for admin-api
const possibleUrls = [
    'https://swcampaignapp-msi-admin-api.lambda-url.us-east-1.on.aws/',
    'https://admin-api.lambda-url.us-east-1.on.aws/',
    'https://swcampaignapp-msi-adminapi.lambda-url.us-east-1.on.aws/',
    'https://amplify-swcampaignapp-msi-admin-api.lambda-url.us-east-1.on.aws/',
    'https://amplify-swcampaignapp-msimp-sandbox-admin-api.lambda-url.us-east-1.on.aws/'
]

async function testUrls() {
    for (const url of possibleUrls) {
        console.log(`Testing URL: ${url}`)
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sendWelcomeEmail',
                    email: 'test@example.com',
                    firstName: 'Test',
                    lastName: 'User',
                    tempPassword: 'TestPass123!'
                })
            })
            
            console.log(`✅ Status: ${response.status}`)
            const text = await response.text()
            console.log(`Response: ${text}`)
            console.log('---')
            
            if (response.status !== 404) {
                console.log(`🎯 FOUND WORKING URL: ${url}`)
                break
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`)
            console.log('---')
        }
    }
}

testUrls()