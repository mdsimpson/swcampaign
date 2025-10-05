#!/usr/bin/env python3
import boto3
import sys
from botocore.exceptions import ClientError

# Table name
TABLE_NAME = 'Address-35li25iqpfd7rbx3fpy56hvq6e-NONE'

# Create DynamoDB client with admin profile
session = boto3.Session(profile_name='admin')
dynamodb = session.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table(TABLE_NAME)

def delete_all_items():
    """Delete all items from the table"""
    
    print(f"Starting deletion of all items from table: {TABLE_NAME}")
    
    deleted_count = 0
    scan_kwargs = {}
    
    try:
        while True:
            # Scan the table
            response = table.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            if not items:
                break
            
            print(f"Found {len(items)} items to delete...")
            
            # Delete items in batch
            with table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(Key={'id': item['id']})
                    deleted_count += 1
                    
                    if deleted_count % 100 == 0:
                        print(f"  Deleted {deleted_count} items...")
            
            # Check if there are more items to scan
            if 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
    
    except ClientError as e:
        print(f"Error: {e}")
        return False
    
    print(f"\nDeletion complete! Total items deleted: {deleted_count}")
    return True

if __name__ == "__main__":
    delete_all_items()