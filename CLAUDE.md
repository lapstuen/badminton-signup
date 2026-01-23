# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ CRITICAL: DEPLOYMENT RULES (READ BEFORE EVERY PUSH!)

**NEVER push to GitHub without updating version number in BOTH APPS:**

### User App (index.html)
1. Header version (line ~29)
2. Footer version (line ~130)
3. Cache-busting in link/script tags (lines ~21, 231, 234)

### Admin App (admin.html)
1. Header version (line ~29)
2. Footer version (line ~130)
3. Cache-busting in link/script tags (lines ~21, 467, 470)

**IMPORTANT:** Keep version numbers synchronized between both apps!

**See DEPLOY_CHECKLIST.md for complete deployment process.**

---

## Repository Overview

This is a web-based badminton session registration system with real-time Firebase synchronization. The app allows players to register for badminton sessions, track payments, and manage authorized users. It's designed as a Progressive Web App (PWA) with bilingual support (English/Thai/Norwegian).

**🆕 SPLIT APP ARCHITECTURE (v2026-01-23):**

The application has been split into two separate apps:

1. **User App** (`index.html`) - Simplified interface for players
   - 65% code reduction (9,140 → 3,150 lines)
   - Clean, user-focused interface
   - No admin functionality exposed
   - All user features: login, registration, wallet, transactions, give 100 baht

2. **Admin App** (`admin.html`) - Full-featured admin interface
   - 100% of original functionality preserved
   - All user features + all admin features
   - Session management, player management, user management, wallet management
   - Line notifications, reports, debugging tools

**Both apps share the same Firebase backend** and sync in real-time.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase Firestore (NoSQL database) + Firebase Cloud Functions
- **Authentication**: Simple password-based auth with Firebase Firestore
- **Deployment**: Firebase Hosting (https://badminton-b95ac.web.app/)
- **Notifications**: Line Messaging API via Firebase Cloud Functions
- **Languages**: Trilingual UI (Norwegian, English, Thai)

## Core Files

### User App (Simplified)
- **index.html** - User interface (237 lines, 49% reduction)
- **app-user.js** - User logic only (~2,400 lines, 70% reduction)
- **style-user.css** - User styles only (515 lines, 51% reduction)

### Admin App (Full Features)
- **admin.html** - Admin interface (469 lines, all features)
- **app-admin.js** - All functionality (7,614 lines, user + admin)
- **style-admin.css** - All styles (1,057 lines, user + admin)

### Shared/Backend
- **firebase-config.js** - Firebase initialization and collection references
- **manifest.json** - PWA manifest for mobile app installation
- **functions/index.js** - Firebase Cloud Functions for Line notifications

### Documentation
- **FIREBASE_SETUP.md** - Complete Firebase setup instructions
- **LINE_NOTIFICATIONS_SETUP.md** - Line Bot and Cloud Functions setup guide
- **CHANGELOG.md** - Version history and feature documentation
- **DEPLOY_CHECKLIST.md** - Deployment checklist
- **SPLIT_APP_SUMMARY.md** - Split app architecture documentation
- **TEST_REPORT.md** - Automated test results (77/77 tests passed)

### Backup Files
- **index-backup-original.html** - Original single app HTML
- **app-backup-original.js** - Original single app JavaScript
- **style-backup-original.css** - Original single app CSS

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

Then open the apps in your browser:
- **User app:** `http://localhost:8000/index.html`
- **Admin app:** `http://localhost:8000/admin.html`

### Production Deployment

**IMPORTANT: Always update version numbers before deploying.**

```bash
# 1. Commit changes to git
git add .
git commit -m "Description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 2. Push to GitHub (backup)
git push origin main

# 3. Deploy to Firebase Hosting
firebase deploy --only hosting

# 4. Deploy Cloud Functions (if functions changed)
firebase deploy --only functions

# Or deploy everything at once:
firebase deploy
```

**Deployment targets:**
- **User App**: https://badminton-b95ac.web.app/ (index.html)
- **Admin App**: https://badminton-b95ac.web.app/admin.html
- **Backend**: Firebase Firestore + Cloud Functions

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

#### User App Functions (app-user.js)

**Initialization Flow**:
1. `initializeApp()` - Orchestrates startup sequence
2. `loadSessionData()` - Loads or creates today's session
3. `loadAuthorizedUsers()` - Fetches authorized user list
4. `setupRealtimeListeners()` - Establishes Firebase listeners
5. `checkLoggedInUser()` - Restores login from localStorage
6. `updateUI()` - Renders current state (simplified version)

**User Actions**:
- `handleLogin()` - Authenticates users against authorized list
- `handleSignup()` - Registers logged-in user for session
- `cancelRegistration()` - Removes user from current session
- `markAsPaid()` - Self-service payment marking
- `handleGuestRegistration()` - Register guest player
- `showMyTransactions()` - View own transaction history
- `showGive100Modal()` - Give 100 baht to other players
- `give100Baht()` - Execute 100 baht transfer
- `refreshBalance()` - Refresh wallet balance

#### Admin App Functions (app-admin.js)

**All user functions PLUS admin functions** (requires password: `SikkertPassord1955`):

**Session Management**:
- `clearSession()` - Starts new session (unpublished draft mode)
- `publishSession()` - Publish session and deduct wallet for unpaid players
- `previewSession()` - Preview session before publishing
- `changeSessionDetails()` - Updates day/time details
- `changePaymentAmount()` - Updates payment amount
- `changeMaxPlayers()` - Changes max player limit
- `closeLastSession()` - Close and archive session

**Player Management**:
- `manageRegularPlayers()` - Manage regular players by day (clickable UI)
- `manageTodaysPlayers()` - Add/remove players for current session
- `togglePlayerForToday()` - Add/remove specific player
- `adminDeletePlayer()` - Remove player from session

**User Management**:
- `manageAuthorizedUsers()` - Add/remove/edit authorized users
- `addAuthorizedUser()` - Create new user
- `editUserPassword()` - Change user password
- `removeAuthorizedUser()` - Delete user

**Wallet Management**:
- `manageWallets()` - Top-up/adjust user wallet balances
- `showBalanceAdjustModal()` - Show wallet adjustment UI
- `confirmBalanceAdjust()` - Execute wallet adjustment
- `initializeAllBalances()` - Set initial balances for all users

**Reports & Analytics**:
- `viewTransactions()` - View all transaction history (admin version)
- `exportList()` - Download player list as text file
- `generateWeeklyReport()` - Generate weekly summary
- `debugViewRawData()` - View raw Firebase data

**Line Notifications**:
- `shareSessionToLine()` - Share session announcement to Line group
- `nudgePlayers()` - Send reminder to unpaid players
- `testLineMessage()` - Test Line notification

**Other Admin**:
- `refundWaitingList()` - Refund all waiting list players
- `toggleMaintenanceMode()` - Enable/disable maintenance mode

### User Flow

#### User App (index.html)
1. **New User**: Must login with authorized credentials first
2. **Logged-in User**: Can register for session with one click
3. **Registered User**: Can mark payment and cancel registration
4. **Guest Registration**: Can register friends/family as guests
5. **Give 100 Baht**: Can help other players with low balance

#### Admin App (admin.html)
1. **Admin Login**: Enter admin password to access admin panel
2. **Session Setup**: Create new session, set details, manage regular players
3. **Publish Session**: Make session visible and deduct wallet balances
4. **User Management**: Add/edit/remove authorized users, manage passwords
5. **Wallet Management**: Top-up balances, view transactions, adjust balances
6. **Session Close**: Archive session, generate reports, send to Line

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

2. **Admin Password**: Hardcoded admin password `SikkertPassord1955` in `loginAdmin()` function in `app-admin.js`. Only accessible in admin app, not exposed in user app.

3. **Firebase Security Rules**: Current rules allow anyone to:
   - Read all data (sessions, players, authorized users)
   - Create and update player records
   - Update payment status

   Only authenticated users (via Firebase Auth) can delete players or modify authorized users. However, the app doesn't use Firebase Authentication - it implements custom auth.

4. **API Key Exposure**: Firebase config with API keys is in `firebase-config.js`. This is normal for Firebase web apps, but ensure Firestore security rules are properly configured.

## Development Patterns

### Adding New Features

**Decide which app to modify:**
- **User features** → Add to `app-user.js`, `index.html`, `style-user.css`
- **Admin features** → Add to `app-admin.js`, `admin.html`, `style-admin.css`
- **Features needed in both** → Add to admin app, then copy to user app if appropriate

When adding features, follow these patterns:

1. **Add to state object** if the feature needs persistent data
2. **Create async function** for Firestore operations
3. **Update `updateUI()`** to reflect changes in the UI
4. **Add event listener** in `setupEventListeners()` if needed
5. **Test real-time sync** by opening multiple browser tabs (one user app, one admin app)
6. **Update version numbers** in both apps before deploying

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

## Split App Architecture Details

### Why Split the App?

**Before (Single App):**
- 9,140 lines of code (HTML + JS + CSS)
- Admin code exposed to all users
- Complex `updateUI()` function handling both user and admin states
- Harder to maintain and understand

**After (Split Apps):**
- **User app:** 3,150 lines (65% reduction)
- **Admin app:** 9,140 lines (100% of original functionality)
- Clean separation of concerns
- Better security (admin code not exposed)
- Easier to understand and maintain

### File Structure

```
User App Files:
├── index.html (237 lines)
├── app-user.js (2,400 lines)
└── style-user.css (515 lines)

Admin App Files:
├── admin.html (469 lines)
├── app-admin.js (7,614 lines)
└── style-admin.css (1,057 lines)

Shared:
├── firebase-config.js
└── manifest.json
```

### Code Reduction Breakdown

| Component | Original | User App | Reduction |
|-----------|----------|----------|-----------|
| HTML | 469 lines | 237 lines | 49% |
| JavaScript | 7,614 lines | 2,400 lines | 70% |
| CSS | 1,057 lines | 515 lines | 51% |
| **Total** | **9,140 lines** | **3,150 lines** | **65%** |

### Functions Removed from User App

**91 admin functions removed**, including:
- Session management (clearSession, publishSession, etc.)
- Player management (manageRegularPlayers, manageTodaysPlayers, etc.)
- User management (manageAuthorizedUsers, addAuthorizedUser, etc.)
- Wallet management (manageWallets, showBalanceAdjustModal, etc.)
- Line notifications (shareSessionToLine, nudgePlayers, etc.)
- Reports (viewTransactions, generateWeeklyReport, etc.)
- Admin UI (loginAdmin, toggleAdmin, selectAdminGroup, etc.)

### Benefits

**For Users:**
- ✅ Faster loading (smaller files)
- ✅ Cleaner interface (no admin button)
- ✅ Better security (admin code not exposed)
- ✅ Same functionality (all user features intact)

**For Admin:**
- ✅ All features preserved
- ✅ Dedicated admin interface
- ✅ Better organization
- ✅ Same Firebase backend

**For Development:**
- ✅ Easier to maintain
- ✅ Independent testing
- ✅ Modular codebase
- ✅ Clear separation

### Rollback Plan

If issues occur, restore original files:

```bash
# Restore original single app
mv index-backup-original.html index.html
mv app-backup-original.js app.js
mv style-backup-original.css style.css

git add .
git commit -m "Rollback to original single app"
git push origin main
```

Backup files preserved:
- `index-backup-original.html`
- `app-backup-original.js`
- `style-backup-original.css`

## Testing Approach

### Manual Testing Checklist

**User App (index.html):**
1. **Login Flow:**
   - Login with authorized user
   - Verify auto-login on page refresh
   - Reset password feature

2. **Registration Flow:**
   - Register for session
   - Verify real-time update in another tab
   - Mark as paid
   - Cancel registration
   - Guest registration

3. **Wallet Features:**
   - View balance (color-coded)
   - View transactions
   - Give 100 baht to another player

4. **Verify NO Admin Access:**
   - No admin button visible
   - No admin panel accessible
   - No admin functions exposed

**Admin App (admin.html):**
1. **Admin Login:**
   - Login to admin panel with password
   - Verify admin actions available

2. **Session Management:**
   - Create new session (draft mode)
   - Preview session
   - Publish session (wallet deduction)
   - Close session

3. **Player Management:**
   - Manage regular players by day
   - Manage today's players
   - Remove players

4. **User Management:**
   - Add/remove authorized users
   - Edit user passwords
   - Reset passwords

5. **Wallet Management:**
   - Top-up user balances
   - View all transactions
   - Initialize balances

6. **Reports & Notifications:**
   - Export player list
   - Share session to Line
   - Generate weekly report
   - Debug view

**Cross-App Testing:**
1. Open both apps in different tabs
2. Make changes in admin app
3. Verify real-time sync in user app
4. Test Firebase data consistency

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

Edit `app-admin.js` (search for `loginAdmin` function):

```javascript
if (password === 'YOUR_NEW_PASSWORD') {
```

**Note:** Admin password is ONLY in admin app, not exposed in user app.

### Changing Default Payment Amount

Edit both `app-user.js` and `app-admin.js`:

```javascript
state.paymentAmount = data.paymentAmount || 10; // Change to your default
```

### Modifying Session Time Format

Edit `changeSessionDetails()` function in `app-admin.js` or modify initial state.

**Note:** Session time changes affect both apps via Firebase sync.

### Adding New User Fields

**In Admin App (`app-admin.js`, `admin.html`):**
1. Update Firestore write operations in `addAuthorizedUser()`
2. Update state loading in `loadAuthorizedUsers()`
3. Update UI rendering in `updateAuthorizedUsersList()`

**In User App (if field should be visible to users):**
1. Update state loading in `loadAuthorizedUsers()`
2. Update UI rendering if needed

### Updating Version Numbers

**CRITICAL:** Update version in BOTH apps before deployment:

**User App:**
- Header: `index.html` line ~29
- Footer: `index.html` line ~130
- Cache-busting: `index.html` lines ~21, 231, 234

**Admin App:**
- Header: `admin.html` line ~29
- Footer: `admin.html` line ~130
- Cache-busting: `admin.html` lines ~21, 467, 470

**Keep versions synchronized!**

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
