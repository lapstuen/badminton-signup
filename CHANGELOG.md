# Changelog

## v2025-11-12 00:15 - Session Summary Feature

### New Features

#### 1. Close Last Session Summary 🏁

Admin can now close a session and view a comprehensive summary with low wallet balance warnings.

**Features:**
- Shows thank you message in 3 languages (Norwegian, Thai, English)
- Displays complete session details (date, time, player count)
- Lists all players who played with payment status
- Shows waiting list if any
- **Warns about users with low wallet balance (<150 THB)**
- Sorted by balance (lowest first) for easy top-up prioritization
- Helps prevent payment issues for next session

**Location:** Admin Panel → "🏁 Close Last Session / Avslutt forrige seanse"

**Summary Contents:**
1. **Thank you message** in 3 languages
2. **Session details:** Day, date, time, player count
3. **Players list:** All players with paid/unpaid status
4. **Waiting list:** If any players were on waiting list
5. **Low balance warning:** Users with <150 THB balance
   - Color-coded: Red (≤0 THB), Orange (0-149 THB)
   - Includes reminder to top up today

**Use Cases:**
- End-of-session summary for admin
- Proactive wallet management
- Payment reconciliation
- Historical record of who played
- Identify users who need wallet top-ups before next session

**Technical Implementation:**
- Modal popup with scrollable content
- No database changes (read-only)
- Filters authorized users by balance
- Sorts by balance (lowest first)

## v2025-11-11 14:00 - Maintenance Mode

### New Features

#### 1. Maintenance Mode for Safe Testing 🔧

Admin can now enable maintenance mode to safely test changes without interfering with real user registrations.

**Features:**
- Toggle maintenance mode on/off from admin panel
- Blocks all user registration and cancellation actions
- Shows maintenance banner to all users
- Admin and moderators can still use all functions
- Realtime sync across all users

**Location:** Admin Panel → Top button "🔧 Enable Maintenance Mode"

**Button States:**
- **Disabled (normal):** Red button "🔧 Enable Maintenance Mode"
- **Enabled:** Green button "✅ Disable Maintenance Mode"

**User Experience:**
- Users see red maintenance banner at top
- Registration and cancellation buttons blocked
- Login still works (but with warning message)
- Admin/moderator bypass all restrictions

**Use Cases:**
- Testing new features without affecting real users
- Debugging registration/cancellation flow
- Safe environment for data migration
- Preventing registrations during manual player management

**Technical Implementation:**
- Stored in Firestore: `sessions/{sessionId}/maintenanceMode`
- Default value: `false`
- Blocks: `handleSignup()`, `handleGuestRegistration()`, `cancelRegistration()`
- Realtime listener updates all connected clients

## v2025-11-07 17:00 - Line Notifications

### New Features

#### 1. Share Session to Line 📤
- New admin button "📤 Share to Line / แชร์ไปยัง Line"
- Shares published session details to Line group
- Shows available spots, waiting list, payment amount
- Includes direct signup link
- Location: Admin Panel → after "Publish Session" button

**Usage:**
1. Publish the session first
2. Click "📤 Share to Line"
3. Confirmation alert appears
4. Line group receives announcement

**Message Format:**
```
🏸 BADMINTON SESSION PUBLISHED!
📅 Day and date
🕐 Time
💰 Payment amount
👥 Current players and available spots
👉 Signup link
```

#### 2. Smart Cancellation Notifications 🎯

**Re-enabled automatic Line notifications when users cancel registration**

**Smart Logic:**
- **No waiting list** → Send "SLOT AVAILABLE!" with signup link
- **With waiting list** → Send simple cancellation notice (no signup link)

**Why smart?**
- If there's a waiting list, the spot is automatically filled
- No need to spam group with signup links when spot isn't actually available
- Reduces notification noise

**Message Examples:**

*No waiting list (10/12 players):*
```
🏸 SLOT AVAILABLE! / มีที่ว่าง!
⚠️ John cancelled registration
👥 Now 9/12 players
👉 Sign up here: [link]
Reply quickly!
```

*With waiting list (14/12 players):*
```
⚠️ Jane cancelled registration
👥 Now 13/12 players
📅 Session details
```

### Technical Changes

#### Frontend (app.js)

1. **New Function: `shareSessionToLine()`** (lines 377-417)
   - Validates session is published
   - Calculates available spots and waiting list
   - Calls Cloud Function `sendSessionAnnouncement`
   - Shows success/error alert

2. **Updated Function: `sendLineCancellationNotification()`** (lines 423-453)
   - Added `hasWaitingList` detection
   - Updated to pass new parameter to Cloud Function
   - Better error handling

3. **Re-enabled Notification Call** (line 494)
   - Uncommented call in `cancelRegistration()`
   - Now sends notification on every cancellation

#### Backend (functions/index.js)

1. **New Cloud Function: `sendSessionAnnouncement`** (lines 21-102)
   - Accepts session details (day, time, players, etc.)
   - Builds formatted message
   - Sends to Line group via Line Messaging API
   - Returns success/failure result

2. **Updated Cloud Function: `sendCancellationNotification`** (lines 108-187)
   - Added `hasWaitingList` parameter
   - Updated message builder with smart logic
   - Conditionally includes signup link and urgency message

3. **New Message Builder: `buildSessionAnnouncementMessage()`** (lines 192-231)
   - Formats session announcement
   - Dynamic message based on available spots
   - Trilingual support (English/Thai)

4. **Updated Message Builder: `buildCancellationMessage()`** (lines 237-269)
   - Smart logic for waiting list
   - Conditional header and footer
   - Cleaner message format

#### UI Changes (index.html)

1. **New Admin Button** (line 117)
   - Green Line-branded button (color: #00C300)
   - Located after "Publish Session" button
   - Calls `shareSessionToLine()` on click

2. **Updated Version** (lines 15, 85)
   - Version: v2025-11-07 17:00 (Line Notifications)

### Documentation

1. **LINE_NOTIFICATIONS_SETUP.md**
   - Complete setup guide for Line Bot
   - Firebase Cloud Functions deployment instructions
   - Environment variables configuration
   - Testing procedures
   - Troubleshooting guide
   - Cost estimates

### Deployment Requirements

⚠️ **IMPORTANT: This update requires Firebase Cloud Functions deployment**

You must deploy the updated Cloud Functions before these features work:

```bash
cd functions
npm install
firebase login
firebase functions:secrets:set LINE_TOKEN
firebase functions:secrets:set LINE_GROUP_ID
firebase deploy --only functions
```

See `LINE_NOTIFICATIONS_SETUP.md` for complete instructions.

### Testing Checklist

- [ ] Set up Line Bot and get credentials
- [ ] Configure Firebase secrets (LINE_TOKEN, LINE_GROUP_ID)
- [ ] Deploy Cloud Functions
- [ ] Test session announcement with available spots
- [ ] Test session announcement when full
- [ ] Test cancellation with no waiting list (should show "SLOT AVAILABLE")
- [ ] Test cancellation with waiting list (should NOT show "SLOT AVAILABLE")
- [ ] Verify Line messages appear in group
- [ ] Check Firebase Functions logs for errors

### Known Limitations

1. Requires Firebase Blaze plan (pay-as-you-go) for Cloud Functions
2. Line Bot must be added to the Line group
3. Free tier limits: 500 Line messages/month, 2M Cloud Function invocations/month
4. Notifications are asynchronous - may take 1-2 seconds to appear in Line

### Future Enhancements

Possible improvements for future versions:
- Automatic daily session announcements
- Reminder notifications before session starts
- Payment confirmation notifications
- Weekly summary reports
- Custom message templates per day of week
- Rich messages with images and buttons

---

## Previous Versions

### v2025-11-07 16:30 - Draft/Publish System

**Major Feature: Draft Mode**
- Sessions start unpublished after "New Session"
- Admin can work on setup without users registering
- "Publish Session" button deducts wallet for all unpaid players
- Visual draft banner for admin/moderator

**New Features:**
- Manage Regular Players - Clickable UI (replaced prompt-based)
- Manage Today's Players - Auto-loads regular players, add/remove options
- Smart wallet deduction on publish

### v2025-11-05 15:30 - Wallet System

**Major Feature: User Wallets**
- Balance tracking per user
- Automatic deduction on registration
- Automatic refund on cancellation
- Transaction history
- Admin wallet management
- Top-up interface

### v2025-11-05 02:28 - Initial Release

**Core Features:**
- User authentication
- Session registration
- Payment tracking
- Admin panel
- Firebase Firestore integration
- PWA support
