# Line Notifications Setup Guide

This guide explains how to set up Line notifications for the badminton registration app.

## Overview

The app now includes two Line notification features:

1. **Session Announcement** - Admin can share published session details to Line group
2. **Cancellation Notification** - Automatic notification when someone cancels registration
   - Smart logic: only mentions available spot if there's no waiting list

## Prerequisites

1. Line Messaging API Channel (Bot)
2. Line Group where notifications will be sent
3. Firebase Cloud Functions enabled (requires Blaze plan)
4. Firebase CLI installed (`npm install -g firebase-tools`)

## Step 1: Create Line Bot

1. Go to [Line Developers Console](https://developers.line.biz/)
2. Create a new Provider (or use existing)
3. Create a new **Messaging API** channel
4. Note down:
   - **Channel Access Token** (Long-lived)
   - Generate if not available: Channel settings → Messaging API → Issue channel access token

## Step 2: Get Line Group ID

### Method A: Using Line Bot API
1. Add your bot to the Line group
2. Send a test message in the group
3. Use Line Bot webhook or API to get the group ID
4. Group IDs start with `C` (e.g., `C1234567890abcdef1234567890abcdef`)

### Method B: Using Line Official Account Manager
1. Add bot to group
2. Check webhook logs for group ID
3. Or use Line Bot SDK test tools

## Step 3: Configure Firebase Cloud Functions

### Install Dependencies
```bash
cd functions
npm install
```

The `package.json` already includes required dependencies:
- `firebase-functions` - Firebase Cloud Functions SDK
- `axios` - HTTP client for Line API calls

### Set Environment Variables

Use Firebase CLI to set the Line credentials:

```bash
# Login to Firebase
firebase login

# Set Line Access Token
firebase functions:secrets:set LINE_TOKEN
# When prompted, paste your Line Channel Access Token

# Set Line Group ID
firebase functions:secrets:set LINE_GROUP_ID
# When prompted, paste your Line Group ID (starts with 'C')
```

Verify the secrets are set:
```bash
firebase functions:secrets:access LINE_TOKEN
firebase functions:secrets:access LINE_GROUP_ID
```

## Step 4: Deploy Cloud Functions

Deploy the functions to Firebase:

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:sendSessionAnnouncement,functions:sendCancellationNotification
```

Expected output:
```
✔  functions[sendSessionAnnouncement(...)] Successful create operation.
✔  functions[sendCancellationNotification(...)] Successful create operation.
```

## Step 5: Update Firebase Security Rules

Ensure your Firestore security rules allow the functions to access user data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow Cloud Functions to read user data
    match /authorizedUsers/{userId} {
      allow read: if request.auth != null || request.auth.token.admin == true;
      allow write: if request.auth != null;
    }
  }
}
```

## Step 6: Test the Notifications

### Test Session Announcement

1. Open the app as admin
2. Create a new session (or use existing)
3. Add some players (if needed)
4. Click "✅ Publish Session"
5. Click "📤 Share to Line"
6. Check your Line group for the announcement message

Expected message format:
```
🏸 BADMINTON SESSION PUBLISHED! / เซสชันเผยแพร่แล้ว!

📅 Monday / วันจันทร์
🕐 18:00 - 20:00
📆 07/11/2025
💰 150 THB

👥 Players: 10/12
✅ 2 spots available!
✅ มี 2 ที่ว่าง!

👉 Sign up here / ลงทะเบียนที่นี่:
https://lapstuen.github.io/badminton-signup/index.html
```

### Test Cancellation Notification

#### Case 1: No Waiting List (should mention available spot)

1. Have someone register for the session
2. That person cancels their registration
3. Check Line group for notification

Expected message:
```
🏸 SLOT AVAILABLE! / มีที่ว่าง!

⚠️ John Doe cancelled registration
John Doe ยกเลิกการลงทะเบียน

👥 Now 9/12 players
ตอนนี้ 9/12 คน

📅 Monday / วันจันทร์
🕐 18:00 - 20:00
📆 07/11/2025

👉 Sign up here / ลงทะเบียนที่นี่:
https://lapstuen.github.io/badminton-signup/index.html

Reply quickly! / ตอบเร็ว!
```

#### Case 2: With Waiting List (should NOT mention available spot)

1. Fill session to max capacity (e.g., 12/12)
2. Add more players to create waiting list (e.g., 14/12)
3. Have an active player (positions 1-12) cancel
4. Check Line group for notification

Expected message:
```
⚠️ Jane Smith cancelled registration
Jane Smith ยกเลิกการลงทะเบียน

👥 Now 13/12 players
ตอนนี้ 13/12 คน

📅 Monday / วันจันทร์
🕐 18:00 - 20:00
📆 07/11/2025
```

Notice: No "SLOT AVAILABLE" header and no signup link because the waiting list will automatically fill the spot.

## Troubleshooting

### Error: "Line Access Token not configured"

**Solution**: Make sure you set the Firebase secrets:
```bash
firebase functions:secrets:set LINE_TOKEN
firebase functions:secrets:set LINE_GROUP_ID
```

### Error: "Failed to send Line notification"

**Possible causes:**
1. Invalid Line Access Token
   - Verify token in Line Developers Console
   - Generate new token if expired
2. Invalid Group ID
   - Ensure bot is added to the group
   - Verify group ID format (starts with 'C')
3. Line API quota exceeded
   - Check Line Developers Console for rate limits
   - Free tier has limited messages per month

### Error: "Firebase function timeout"

**Solution**: Increase function timeout in `functions/index.js`:
```javascript
exports.sendSessionAnnouncement = onCall({
    timeoutSeconds: 60,
    memory: '256MB'
}, async (request) => {
    // ... function code
});
```

### Notifications not appearing in browser console

Check Firebase Functions logs:
```bash
firebase functions:log --only sendSessionAnnouncement
firebase functions:log --only sendCancellationNotification
```

Or view logs in Firebase Console:
1. Go to Firebase Console → Functions
2. Click on function name
3. View "Logs" tab

## Cost Considerations

### Firebase Cloud Functions (Blaze Plan)

**Free tier includes:**
- 2 million invocations/month
- 400,000 GB-seconds/month
- 200,000 CPU-seconds/month
- 5GB network egress/month

**Our usage (estimated):**
- Session announcements: ~5-10 times/week = ~40/month
- Cancellations: ~10-20 times/week = ~80/month
- **Total: ~120 invocations/month** (well within free tier)

### Line Messaging API

**Free tier:**
- 500 messages/month (Push API)

**Our usage (estimated):**
- ~120 notifications/month (within free tier)

## Security Best Practices

1. **Never commit secrets** - Use Firebase secrets or environment variables
2. **Validate input** - Cloud Functions validate all incoming data
3. **Error handling** - Functions handle errors gracefully without exposing sensitive data
4. **Rate limiting** - Consider adding rate limits to prevent spam

## Additional Resources

- [Line Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Secrets Management](https://firebase.google.com/docs/functions/config-env)

## Support

If you encounter issues:
1. Check Firebase Functions logs
2. Check Line Developers Console for API errors
3. Verify all environment variables are set correctly
4. Test with simple message first before debugging complex scenarios
