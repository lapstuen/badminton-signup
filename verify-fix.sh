#!/bin/bash

# Get FCM token from Firestore
TOKEN=$(firebase firestore:get authorizedUsers/KyRo8G7ND4d2zNdDe0E8u5VtEJL2 2>/dev/null | grep fcmToken | awk -F': ' '{print $2}' | tr -d '"')

if [ -z "$TOKEN" ]; then
    echo "❌ Could not get FCM token from Firestore"
    echo "Manual check: firebase firestore:get authorizedUsers/KyRo8G7ND4d2zNdDe0E8u5VtEJL2"
    exit 1
fi

echo "✅ Found FCM token: ${TOKEN:0:30}..."
echo ""
echo "📤 Testing FCM send with curl..."
echo ""

# Get OAuth2 token
ACCESS_TOKEN=$(node print-token.js 2>/dev/null | grep "Access token starts with:" | awk '{print $NF}')

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not generate OAuth2 token"
    exit 1
fi

# Send FCM test
RESPONSE=$(curl -s -X POST \
  "https://fcm.googleapis.com/v1/projects/badminton-b95ac/messages:send" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"token\": \"$TOKEN\",
      \"notification\": {
        \"title\": \"✅ FCM FIX VERIFIED\",
        \"body\": \"Production APNs key upload successful!\"
      },
      \"apns\": {
        \"payload\": {
          \"aps\": {
            \"alert\": {
              \"title\": \"✅ FCM FIX VERIFIED\",
              \"body\": \"Production APNs key upload successful!\"
            },
            \"sound\": \"default\",
            \"badge\": 1
          }
        }
      }
    }
  }")

echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "BadEnvironmentKeyInToken"; then
    echo "❌ STILL FAILING - BadEnvironmentKeyInToken error persists"
    echo "Check that Production APNs key was uploaded correctly"
elif echo "$RESPONSE" | grep -q "\"name\""; then
    echo "✅ SUCCESS! FCM sent successfully!"
    echo "Check your iPhone for the notification"
else
    echo "⚠️  Unexpected response - check output above"
fi
