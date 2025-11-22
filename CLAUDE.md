# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ CRITICAL: DEPLOYMENT RULES (READ BEFORE EVERY PUSH!)

**NEVER push to GitHub without updating version number in ALL 3 PLACES:**

1. Header version (index.html line ~29)
2. Footer version (index.html line ~130)
3. Cache-busting in script tags (index.html line ~400-403)

**ALWAYS use the automatic script:**
```bash
./update-version.sh "v2025-11-22 HH:MM" "Description of changes"
```

**Or manually verify ALL THREE locations are updated before git push.**

**See DEPLOY_CHECKLIST.md for complete deployment process.**

---

## Repository Overview

This is a web-based badminton session registration system with real-time Firebase synchronization. The app allows players to register for badminton sessions, track payments, and manage authorized users. It's designed as a Progressive Web App (PWA) with bilingual support (English/Thai/Norwegian).

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase Firestore (NoSQL database) + Firebase Cloud Functions
- **Authentication**: Simple password-based auth with Firebase Firestore
- **Deployment**: GitHub Pages (https://lapstuen.github.io/badminton-signup/)
- **Notifications**: Line Messaging API via Firebase Cloud Functions
- **Languages**: Trilingual UI (Norwegian, English, Thai)

## Core Files

- **index.html** - Main application entry point with trilingual UI
- **app.js** - Main application logic with wallet system, draft/publish, Line notifications
- **firebase-config.js** - Firebase initialization and collection references
- **style.css** - Application styling
- **manifest.json** - PWA manifest for mobile app installation
- **functions/index.js** - Firebase Cloud Functions for Line notifications
- **FIREBASE_SETUP.md** - Complete Firebase setup instructions
- **LINE_NOTIFICATIONS_SETUP.md** - Line Bot and Cloud Functions setup guide
- **CHANGELOG.md** - Version history and feature documentation
- **DEPLOY_CHECKLIST.md** - Deployment checklist

## Running the Application

### Local Development

Since this is a static web app with Firebase backend, you can run it with any local server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js http-server (requires: npm install -g http-server)
http-server -p 8000

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Production Deployment

**IMPORTANT: Always commit and push to GitHub after making changes. Always update version number.**

```bash
# 1. Commit changes to git
git add .
git commit -m "Description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 2. Push to GitHub (auto-deploys to GitHub Pages)
git push origin main

# 3. Deploy Cloud Functions (if functions changed)
firebase deploy --only functions
```

**Deployment targets:**
- **Frontend**: GitHub Pages at https://lapstuen.github.io/badminton-signup/
- **Backend**: Firebase Cloud Functions (requires deploy command)

## Firebase Configuration

The app uses Firebase Firestore with the following structure:

### Firestore Collections

```
/sessions/{sessionId}
  ├─ date: string (DD/MM/YYYY)
  ├─ day: string (e.g., "Monday / วันจันทร์")
  ├─ time: string (e.g., "18:00 - 20:00")
  ├─ maxPlayers: number
  ├─ paymentAmount: number
  └─ /players/{playerId}
      ├─ name: string
      ├─ paid: boolean
      ├─ timestamp: timestamp
      ├─ position: number
      └─ clickedPaymentLink: boolean (optional)

/authorizedUsers/{userId}
  ├─ name: string
  ├─ password: string (plain text - consider hashing for production)
  └─ createdAt: timestamp
```

### Session ID Format

Sessions are identified by date in ISO format: `YYYY-MM-DD`

```javascript
let currentSessionId = new Date().toISOString().split('T')[0]; // "2025-01-04"
```

This means each day automatically gets a new session.

## Application Architecture

### State Management

The app uses a simple global state object synchronized with Firebase:

```javascript
let state = {
    players: [],              // Array of player objects
    maxPlayers: 12,          // Maximum players per session
    sessionDate: string,     // Display date
    sessionDay: string,      // Day of week with translations
    sessionTime: string,     // Session time range
    paymentAmount: 150,      // Payment amount in THB
    published: true,         // Session visibility (false = draft mode)
    isAdmin: false,          // Admin panel access
    authorizedUsers: [],     // List of authorized users
    loggedInUser: null,      // Current logged-in user
    transactions: []         // Transaction history
};
```

### Real-time Synchronization

The app uses Firestore's `onSnapshot()` listeners for real-time updates:

```javascript
// Players listener - updates UI when players change
playersRef().onSnapshot((snapshot) => {
    // Updates state.players and triggers updateUI()
});

// Users listener - updates authorized users list
usersRef.onSnapshot((snapshot) => {
    // Updates state.authorizedUsers
});
```

### Key Functions

**Initialization Flow**:
1. `initializeApp()` - Orchestrates startup sequence
2. `loadSessionData()` - Loads or creates today's session
3. `loadAuthorizedUsers()` - Fetches authorized user list
4. `setupRealtimeListeners()` - Establishes Firebase listeners
5. `checkLoggedInUser()` - Restores login from localStorage
6. `updateUI()` - Renders current state

**User Actions**:
- `handleLogin()` - Authenticates users against authorized list
- `handleSignup()` - Registers logged-in user for session
- `cancelRegistration()` - Removes user from current session
- `markAsPaid()` - Self-service payment marking

**Admin Actions** (requires password: `admin123`):
- `clearSession()` - Starts new session (unpublished draft mode)
- `changeSessionDetails()` - Updates day/time details
- `manageRegularPlayers()` - Manage regular players by day (clickable UI)
- `manageTodaysPlayers()` - Add/remove players for current session
- `publishSession()` - Publish session and deduct wallet for unpaid players
- `shareSessionToLine()` - Share session announcement to Line group
- `changePaymentAmount()` - Updates payment amount
- `changeMaxPlayers()` - Changes max player limit
- `manageAuthorizedUsers()` - Add/remove/edit authorized users
- `manageWallets()` - Top-up/adjust user wallet balances
- `viewTransactions()` - View transaction history
- `refundWaitingList()` - Refund all waiting list players
- `exportList()` - Download player list as text file

### User Flow

1. **New User**: Must login with authorized credentials first
2. **Logged-in User**: Can register for session with one click
3. **Registered User**: Can mark payment and cancel registration
4. **Admin**: Access admin panel to manage sessions and users

### localStorage and Multi-Device Usage

**Important: localStorage is per browser/device**

The app uses localStorage for auto-login, which is stored **locally on each device**:

```javascript
localStorage.setItem('loggedInUser', JSON.stringify({
    name: userName,
    userId: userId,
    role: role,
    authToken: password,  // Stored for auto-login validation
    balance: balance
}));
```

**Multi-Device Behavior:**
- Each device (Mac Safari, iPhone Safari, iPad Safari, etc.) has separate localStorage
- Users must login **once per device** with username + password
- After first login, auto-login works on that device indefinitely
- Auto-login persists until:
  - User's password is reset by admin
  - Browser data/localStorage is cleared
  - User explicitly logs out

**Password Management:**
- **Auto-generated passwords (UUID)**: Long random strings, generated when:
  - Admin creates new user (without specifying password)
  - Admin resets password (leaves password field empty)
- **Custom passwords**: Admin can set fixed passwords (e.g., "geir2025", "12345678")
  - Recommended for users with multiple devices
  - Same password works across all devices
  - Users only need to remember one password for all logins

**Multi-Device Setup (Recommended):**
1. Admin sets a memorable password for user (e.g., 8-digit number or phrase)
2. User logs in on first device (Mac) → auto-login enabled
3. User logs in on second device (iPhone) → auto-login enabled
4. User logs in on third device (iPad) → auto-login enabled
5. User stays logged in on all devices unless password is reset

**Troubleshooting:**
- If user reports "always logged out": Ask if they use multiple devices
- If yes: They need to login once per device (expected behavior)
- If no (same device): Check if browser is clearing localStorage or user is in private browsing mode

## Security Notes

⚠️ **Important Security Considerations**:

1. **Plain Text Passwords**: User passwords are stored in plain text in Firestore. For production, implement proper password hashing (bcrypt, scrypt, etc.).

2. **Admin Password**: Hardcoded admin password `admin123` in `loginAdmin()` function (line 556). Change this immediately for production.

3. **Firebase Security Rules**: Current rules allow anyone to:
   - Read all data (sessions, players, authorized users)
   - Create and update player records
   - Update payment status

   Only authenticated users (via Firebase Auth) can delete players or modify authorized users. However, the app doesn't use Firebase Authentication - it implements custom auth.

4. **API Key Exposure**: Firebase config with API keys is in `firebase-config.js`. This is normal for Firebase web apps, but ensure Firestore security rules are properly configured.

## Development Patterns

### Adding New Features

When adding features, follow these patterns:

1. **Add to state object** if the feature needs persistent data
2. **Create async function** for Firestore operations
3. **Update `updateUI()`** to reflect changes in the UI
4. **Add event listener** in `setupEventListeners()` if needed
5. **Test real-time sync** by opening multiple browser tabs

### Bilingual Support

The app uses inline bilingual text:

```javascript
// In HTML
<button>Join<br>เข้าร่วม</button>

// In JavaScript alerts
alert('You are registered / คุณลงทะเบียนแล้ว');
```

When adding new UI text, always include both English and Thai translations separated by ` / `.

### Player Position Management

Players are ordered by `position` field (1-indexed). When registering:

```javascript
position: state.players.length + 1
```

Players 1-12 (or up to `maxPlayers`) are active players. Remaining players go to waiting list.

## Testing Approach

### Manual Testing Checklist

1. **Registration Flow**:
   - Login with authorized user
   - Register for session
   - Verify real-time update in another tab
   - Mark as paid
   - Cancel registration

2. **Admin Functions**:
   - Login to admin panel
   - Add/remove authorized users
   - Change session details
   - Mark payments
   - Export list
   - Start new session

3. **Edge Cases**:
   - Reach max players limit
   - Duplicate name registration attempt
   - Unauthorized user login attempt
   - Session date rollover at midnight

### Browser Console Testing

```javascript
// Check current state
console.log(state);

// Check Firebase connection
console.log(db);

// Manually trigger UI update
updateUI();

// Check current session
currentSessionRef().get().then(doc => console.log(doc.data()));
```

## Common Development Tasks

### Changing Admin Password

Edit line 556 in `app.js`:

```javascript
if (password === 'YOUR_NEW_PASSWORD') {
```

### Changing Default Payment Amount

Edit line 79 in `app.js`:

```javascript
state.paymentAmount = data.paymentAmount || 200; // Change 150 to your default
```

### Modifying Session Time Format

Edit the session details in `changeSessionDetails()` function (line 591) or modify initial state (line 14).

### Adding New User Fields

1. Update Firestore write operations in `addAuthorizedUser()`
2. Update state loading in `loadAuthorizedUsers()`
3. Update UI rendering in `updateAuthorizedUsersList()`

## Debugging

### Common Issues

**"Firebase: No Firebase App '[DEFAULT]' has been created"**
- Ensure `firebase-config.js` loads before `app.js` in `index.html`
- Check line 121-125 in index.html

**Players not showing up**
- Open browser console and check for Firestore errors
- Verify Firebase rules allow read access
- Check network tab for failed requests

**Real-time updates not working**
- Verify `setupRealtimeListeners()` is called
- Check browser console for listener errors
- Test with Firebase Console to confirm data is changing

**Admin panel not opening**
- Check console for JavaScript errors
- Verify admin password is correct
- Ensure admin panel HTML is in index.html (line 86-114)

### Debug Mode

Add this to browser console for verbose logging:

```javascript
// Enable Firestore debug logging
firebase.firestore.setLogLevel('debug');

// Log all state changes
const originalUpdateUI = updateUI;
updateUI = function() {
    console.log('UI Update:', state);
    originalUpdateUI();
};
```

## Version History

The app includes version display in the footer:

```html
<p class="version">Version: 2025-01-04 15:45</p>
```

Update this timestamp when deploying significant changes.

## Firebase Setup

For complete Firebase setup instructions, see `FIREBASE_SETUP.md`. Key steps:

1. Create Firebase project
2. Enable Firestore Database (asia-southeast1 recommended)
3. Configure security rules
4. Register web app and copy config to `firebase-config.js`
5. Test with browser console

## Line Notifications (Firebase Cloud Functions)

The app includes Line notification features via Firebase Cloud Functions:

### Functions

1. **sendSessionAnnouncement** - Shares published session to Line group
   - Called when admin clicks "📤 Share to Line"
   - Sends session details, available spots, waiting list count
   - Location: `functions/index.js:17-102`

2. **sendCancellationNotification** - Automatic notification when user cancels
   - **Smart logic**: Only mentions "SLOT AVAILABLE" if no waiting list
   - If waiting list exists, sends simple cancellation notice
   - Location: `functions/index.js:104-187`

### Configuration

Line credentials are stored using **legacy Firebase config**:
```bash
firebase functions:config:set line.token="YOUR_LINE_CHANNEL_ACCESS_TOKEN"
firebase functions:config:set line.groupid="YOUR_LINE_GROUP_ID"
```

Access in code:
```javascript
const accessToken = functions.config().line.token;
const groupId = functions.config().line.groupid;
```

### Deployment

```bash
# Deploy Cloud Functions
firebase deploy --only functions

# View logs
firebase functions:log
```

**Important**: Firebase Cloud Functions require Blaze plan (pay-as-you-go), but estimated usage (~120 notifications/month) is within free tier.

For complete setup guide, see `LINE_NOTIFICATIONS_SETUP.md`.

## Key Features

### 1. Wallet System
- Each user has a balance (in THB)
- Auto-deduct on registration, auto-refund on cancellation
- Admin can top-up balances via "Manage Wallets"
- Transaction history tracking
- Location: `app.js:1820-2050`

### 2. Draft/Publish System
- New sessions start in draft mode (unpublished)
- Admin can setup session without users registering
- "Publish Session" makes session visible and deducts wallet for unpaid players
- Visual draft banner for admin/moderator
- Location: `app.js:982-1063`

### 3. Regular Players Management
- Assign regular players per day of week (1-7)
- Clickable UI for easy selection
- Auto-loads regular players when admin opens "Manage Today's Players"
- Location: `app.js:1142-1286`

### 4. Today's Players Management
- Add/remove players for current session
- Two options: THIS session only, or ALL sessions (make regular player)
- Auto-loads regular players on first open
- Location: `app.js:1515-1816`

## Related Files

- **app-backup-*.js** - Timestamped backups before major changes
- **index-backup-*.html** - HTML backups
- **app-firebase.js** - Migration version during Firebase implementation
- **debug.html** - Debug/testing page
- **diagnose.html** - Diagnostic utilities
- **test-firebase.html** - Firebase connection testing
- **migrate-friday-data.js** - Data migration script
