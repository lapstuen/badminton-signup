# Deployment Checklist - Line Notifications Update

## Quick Deployment Guide

Follow these steps to deploy the Line notifications feature:

### Step 1: Line Bot Setup (One-time)

- [ ] Go to [Line Developers Console](https://developers.line.biz/)
- [ ] Create Messaging API channel (or use existing)
- [ ] Get **Channel Access Token** (Long-lived)
- [ ] Add bot to your Line group
- [ ] Get **Group ID** (starts with 'C')

**Notes:**
- Save Channel Access Token somewhere safe
- Group ID can be found in webhook logs or via API

### Step 2: Configure Firebase Secrets

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Navigate to project directory
cd /Users/geirlapstuen/Swift/lineapp

# Set Line credentials
firebase functions:secrets:set LINE_TOKEN
# Paste your Line Channel Access Token when prompted

firebase functions:secrets:set LINE_GROUP_ID
# Paste your Line Group ID when prompted
```

**Verification:**
```bash
firebase functions:secrets:access LINE_TOKEN
firebase functions:secrets:access LINE_GROUP_ID
```

### Step 3: Install Dependencies

```bash
cd functions
npm install
```

Expected packages:
- firebase-functions
- firebase-admin
- axios

### Step 4: Deploy Cloud Functions

```bash
# From project root directory
firebase deploy --only functions
```

**Expected output:**
```
✔  functions[sendSessionAnnouncement(...)] Successful create operation.
✔  functions[sendCancellationNotification(...)] Successful create operation.
```

**Deployment time:** ~2-3 minutes

### Step 5: Deploy Frontend to GitHub Pages

```bash
# Add all changes
git add .

# Commit changes
git commit -m "Add Line notification features v2025-11-07"

# Push to GitHub
git push origin main
```

**Note:** GitHub Pages auto-deploys from main branch

### Step 6: Test Notifications

#### Test 1: Session Announcement

1. Open app: https://lapstuen.github.io/badminton-signup/index.html
2. Login as admin
3. Click "New Session" (if needed)
4. Click "Edit Session" and set details
5. Click "Manage Today's Players" and add players
6. Click "✅ Publish Session"
7. Click "📤 Share to Line"
8. **Verify:** Check Line group for announcement message

#### Test 2: Cancellation (No Waiting List)

1. Register a user for the session
2. That user cancels registration
3. **Verify:** Line message says "SLOT AVAILABLE!" with signup link

#### Test 3: Cancellation (With Waiting List)

1. Fill session to max (e.g., 12/12)
2. Add 2 more players (creates waiting list: 14/12)
3. Active player cancels
4. **Verify:** Line message does NOT say "SLOT AVAILABLE!" (no link)

### Step 7: Monitor Logs

```bash
# View Cloud Functions logs
firebase functions:log

# Or specific function
firebase functions:log --only sendSessionAnnouncement
firebase functions:log --only sendCancellationNotification
```

**What to look for:**
- ✅ "Session announcement sent successfully"
- ✅ "Cancellation notification sent successfully"
- ❌ Any error messages

## Troubleshooting Quick Fixes

### "Line Access Token not configured"

```bash
firebase functions:secrets:set LINE_TOKEN
# Enter correct token
firebase deploy --only functions
```

### "Failed to send Line notification"

**Check:**
1. Bot is added to Line group
2. Group ID is correct (starts with 'C')
3. Access token is valid (check Line Console)

**Fix:**
```bash
# Update secrets
firebase functions:secrets:set LINE_TOKEN
firebase functions:secrets:set LINE_GROUP_ID

# Redeploy
firebase deploy --only functions
```

### Functions not updating

```bash
# Force redeploy
firebase deploy --only functions --force
```

### GitHub Pages not updating

```bash
# Force push
git push origin main --force

# Or clear cache
# Wait 5-10 minutes for GitHub Pages to rebuild
```

## Rollback Plan

If something goes wrong:

### Rollback Cloud Functions

```bash
# View deployment history
firebase functions:list

# Rollback to previous version
firebase rollback --only functions
```

### Rollback Frontend

```bash
# Revert git commit
git revert HEAD

# Push to GitHub
git push origin main
```

### Disable Notifications Temporarily

In `app.js` line 494, comment out:

```javascript
// sendLineCancellationNotification(userName);
```

Then deploy:
```bash
git add app.js
git commit -m "Temporarily disable Line notifications"
git push origin main
```

## Post-Deployment Verification

- [ ] Test session announcement works
- [ ] Test cancellation notification (no waiting list)
- [ ] Test cancellation notification (with waiting list)
- [ ] Check Firebase Functions logs (no errors)
- [ ] Verify Line messages appear in group
- [ ] Check Firebase billing (should be minimal)
- [ ] Update team about new features

## Files Modified

### Frontend
- `index.html` - Added "Share to Line" button, version update
- `app.js` - Added `shareSessionToLine()`, updated notification logic
- `style.css` - No changes (uses existing modal styles)

### Backend
- `functions/index.js` - Added `sendSessionAnnouncement`, updated `sendCancellationNotification`

### Documentation
- `LINE_NOTIFICATIONS_SETUP.md` - Complete setup guide
- `CHANGELOG.md` - Version history and features
- `DEPLOY_CHECKLIST.md` - This file

## Cost Estimate

**Firebase Cloud Functions (Blaze Plan):**
- Estimated usage: ~120 invocations/month
- Free tier: 2,000,000 invocations/month
- **Cost: $0/month** (within free tier)

**Line Messaging API:**
- Estimated usage: ~120 messages/month
- Free tier: 500 messages/month
- **Cost: $0/month** (within free tier)

**Total estimated cost: $0/month**

## Support Resources

- **Line API Docs:** https://developers.line.biz/en/docs/messaging-api/
- **Firebase Functions:** https://firebase.google.com/docs/functions
- **Project Repo:** https://github.com/lapstuen/badminton-signup
- **Live App:** https://lapstuen.github.io/badminton-signup/

## Need Help?

1. Check `LINE_NOTIFICATIONS_SETUP.md` for detailed setup
2. Check `CHANGELOG.md` for feature details
3. Check Firebase Functions logs for errors
4. Check Line Developers Console for API issues
5. Test with simple messages first before complex scenarios

---

**Deployment Date:** 2025-11-07
**Version:** v2025-11-07 17:00 (Line Notifications)
**Status:** Ready for deployment ✅
