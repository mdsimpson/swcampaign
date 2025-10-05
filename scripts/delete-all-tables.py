#!/usr/bin/env python3
import boto3
import sys
from botocore.exceptions import ClientError

# Tables to delete in order (respecting foreign key dependencies)
TABLES = [
    'Assignment-35li25iqpfd7rbx3fpy56hvq6e-NONE',
    'InteractionRecord-35li25iqpfd7rbx3fpy56hvq6e-NONE',
    'Consent-35li25iqpfd7rbx3fpy56hvq6e-NONE',
    'Resident-35li25iqpfd7rbx3fpy56hvq6e-NONE',  # Already done, but include for completeness
    'Address-35li25iqpfd7rbx3fpy56hvq6e-NONE'
]

# Create DynamoDB client with admin profile
session = boto3.Session(profile_name='admin')
dynamodb = session.resource('dynamodb', region_name='us-east-1')

def delete_all_items_from_table(table_name):
    """Delete all items from a specific table"""
    
    print(f"\nDeleting all items from table: {table_name}")
    
    try:
        table = dynamodb.Table(table_name)
        
        deleted_count = 0
        scan_kwargs = {}
        
        while True:
            # Scan the table
            response = table.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            if not items:
                break
            
            print(f"  Found {len(items)} items to delete...")
            
            # Delete items in batch
            with table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(Key={'id': item['id']})
                    deleted_count += 1
                    
                    if deleted_count % 100 == 0:
                        print(f"    Deleted {deleted_count} items...")
            
            # Check if there are more items to scan
            if 'LastEvaluatedKey' not in response:
                break
            
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        print(f"  ✓ Deleted {deleted_count} items from {table_name}")
        return True
        
    except ClientError as e:
        print(f"  ✗ Error deleting from {table_name}: {e}")
        return False

def main():
    print("=" * 60)
    print("DELETING ALL DATA FROM DYNAMODB TABLES")
    print("=" * 60)
    
    for table_name in TABLES:
        delete_all_items_from_table(table_name)
    
    print("\n" + "=" * 60)
    print("DELETION COMPLETE")
    print("=" * 60)
    print("\nYou can now run: npm run reset:import")
    print("to import fresh data from address2.csv and residents2.csv")

if __name__ == "__main__":
    main()