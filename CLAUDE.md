# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a web-based badminton session registration system with real-time Firebase synchronization. The app allows players to register for badminton sessions, track payments, and manage authorized users. It's designed as a Progressive Web App (PWA) with bilingual support (English/Thai/Norwegian).

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase Firestore (NoSQL database)
- **Authentication**: Simple password-based auth with Firebase Firestore
- **Deployment**: Static hosting (works with any web server or Firebase Hosting)
- **Languages**: Trilingual UI (Norwegian, English, Thai)

## Core Files

- **index.html** - Main application entry point with bilingual UI
- **app.js** - Main application logic (~850 lines)
- **firebase-config.js** - Firebase initialization and collection references
- **style.css** - Application styling
- **manifest.json** - PWA manifest for mobile app installation
- **FIREBASE_SETUP.md** - Complete Firebase setup instructions

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

```bash
# Deploy to Firebase Hosting (if configured)
firebase deploy --only hosting

# Or deploy to any static hosting service (Netlify, Vercel, GitHub Pages, etc.)
# Just upload all files to the hosting service
```

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
    isAdmin: false,          // Admin panel access
    authorizedUsers: [],     // List of authorized users
    loggedInUser: null       // Current logged-in user
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
- `clearSession()` - Starts new session (deletes all players)
- `changeSessionDetails()` - Updates day/time/regular players
- `changePaymentAmount()` - Updates payment amount
- `changeMaxPlayers()` - Changes max player limit
- `manageAuthorizedUsers()` - Add/remove/edit authorized users
- `togglePayment()` - Mark players as paid/unpaid
- `exportList()` - Download player list as text file

### User Flow

1. **New User**: Must login with authorized credentials first
2. **Logged-in User**: Can register for session with one click
3. **Registered User**: Can mark payment and cancel registration
4. **Admin**: Access admin panel to manage sessions and users

### localStorage Usage

The app persists two pieces of data locally:

```javascript
localStorage.setItem('userName', name);              // Deprecated, kept for compatibility
localStorage.setItem('loggedInUser', JSON.stringify({name}));  // Current login
```

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

## Related Files

- **app-backup.js** - Previous version backup
- **app-firebase.js** - Migration version during Firebase implementation
- **debug.html** - Debug/testing page
- **export-data.html** - Data export utility
- **qr-generator.html** - QR code generator utility
- **firebase-test.html** - Firebase connection testing page
