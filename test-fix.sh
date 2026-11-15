#!/bin/bash

TOKEN="cIAQ_4XqMk84i1C8HCw4kS:APA91bGs7fTFGTOM_JG4GG4k4--PmCvozEht3AkFEPQvtI_8IFAB9W-joOs3JugBYPYU8WVz5iWA80E3UOQTMpi7CtOl5QWtm7fcBn3Xbg6Mhr2-0HL35vs"

echo "📱 FCM Token: ${TOKEN:0:30}..."
echo ""
echo "🔑 Getting OAuth2 access token..."

# Get access token
ACCESS_TOKEN=$(GOOGLE_APPLICATION_CREDENTIALS=/Users/geirlapstuen/Swift/lineapp/serviceAccountKey.json node print-token.js 2>/dev/null | grep "Access token starts with:" | awk '{print $NF}')

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not generate OAuth2 token"
    exit 1
fi

echo "✅ Got OAuth2 token: ${ACCESS_TOKEN:0:20}..."
echo ""
echo "📤 Sending FCM test notification..."
echo ""

# Send test notification
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

echo "📊 Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""
echo "═══════════════════════════════════════════════════════════"

if echo "$RESPONSE" | grep -q "BadEnvironmentKeyInToken"; then
    echo "❌ STILL FAILING - BadEnvironmentKeyInToken error"
    echo ""
    echo "This means the Production APNs key was NOT uploaded correctly."
    echo "Please double-check Firebase Console."
elif echo "$RESPONSE" | grep -q "\"name\""; then
    echo "✅✅✅ SUCCESS! FCM MESSAGE SENT! ✅✅✅"
    echo ""
    echo "Check your iPhone NOW for the notification!"
    echo ""
    echo "If you received it, the 18+ hour debugging session is COMPLETE!"
else
    echo "⚠️  Unexpected response - check output above"
fi
