// Delete all items from Resident DynamoDB table
import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'

const TABLE_NAME = 'Resident-35li25iqpfd7rbx3fpy56hvq6e-NONE'
const BATCH_SIZE = 25 // DynamoDB batch write limit

// Use admin profile
const client = new DynamoDBClient({
    region: 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN
    }
})

async function deleteAllItems() {
    console.log(`Starting deletion of all items from table: ${TABLE_NAME}`)
    
    let totalDeleted = 0
    let lastEvaluatedKey = undefined
    
    do {
        // Scan for items
        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            ExclusiveStartKey: lastEvaluatedKey,
            ProjectionExpression: 'id' // Only get the id field for deletion
        })
        
        const scanResult = await client.send(scanCommand)
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
            break
        }
        
        console.log(`Found ${scanResult.Items.length} items to delete...`)
        
        // Process in batches of 25
        for (let i = 0; i < scanResult.Items.length; i += BATCH_SIZE) {
            const batch = scanResult.Items.slice(i, i + BATCH_SIZE)
            
            const deleteRequests = batch.map(item => ({
                DeleteRequest: {
                    Key: {
                        id: item.id
                    }
                }
            }))
            
            const batchCommand = new BatchWriteItemCommand({
                RequestItems: {
                    [TABLE_NAME]: deleteRequests
                }
            })
            
            try {
                await client.send(batchCommand)
                totalDeleted += deleteRequests.length
                console.log(`  Deleted ${totalDeleted} items so far...`)
            } catch (error) {
                console.error('Error in batch delete:', error)
                // Continue with next batch
            }
        }
        
        lastEvaluatedKey = scanResult.LastEvaluatedKey
    } while (lastEvaluatedKey)
    
    console.log(`\nDeletion complete! Total items deleted: ${totalDeleted}`)
}

deleteAllItems().catch(console.error)