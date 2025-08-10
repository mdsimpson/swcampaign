#!/usr/bin/env bash
set -euo pipefail
EMAIL="${1:-michael.d.simpson@gmail.com}"
TEMP_PASSWORD="${2:-TempPass#2025}"
if [ ! -f "./amplify_outputs.json" ]; then echo "amplify_outputs.json not found. Run 'npm run sandbox' once, or download it from Amplify console."; exit 1; fi
POOL_ID=$(jq -r '.auth.user_pool_id' amplify_outputs.json)
if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "null" ]; then echo "Could not read user pool id from amplify_outputs.json"; exit 1; fi
echo "Using user pool: $POOL_ID"
aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name Administrator --description "Administrators" || true
aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name Organizer --description "Organizers" || true
aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name Canvasser --description "Canvassers" || true
aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name Member --description "Members" || true
aws cognito-idp admin-create-user --user-pool-id "$POOL_ID" --username "$EMAIL" --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true --temporary-password "$TEMP_PASSWORD" --message-action SUPPRESS || true
aws cognito-idp admin-set-user-password --user-pool-id "$POOL_ID" --username "$EMAIL" --password "$TEMP_PASSWORD" --permanent
aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" --username "$EMAIL" --group-name Administrator
echo "Admin user ensured for $EMAIL."
