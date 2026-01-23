# 🏸 Badminton Registration System

Web-based badminton session registration with real-time Firebase synchronization, wallet system, and Line notifications.

## 🆕 Split App Architecture (v2026-01-23)

This system consists of **two separate applications** sharing the same Firebase backend:

### 👥 User App (`index.html`)
**Clean, simplified interface for players**

- ✅ Login and auto-login
- ✅ Register for sessions
- ✅ Wallet and balance tracking
- ✅ Mark as paid
- ✅ Guest registration
- ✅ Give 100 baht to other players
- ✅ View own transactions
- ❌ No admin functionality

**65% code reduction** - Easier to understand, faster loading, more secure.

**URL:** https://badminton-b95ac.web.app/

### 👨‍💼 Admin App (`admin.html`)
**Full-featured admin interface**

- ✅ All user features
- ✅ Session management (create, publish, close)
- ✅ Player management (regular players, today's players)
- ✅ User management (add, edit, remove)
- ✅ Wallet management (top-up, adjust)
- ✅ Line notifications
- ✅ Reports and debugging

**URL:** https://badminton-b95ac.web.app/admin.html

## 🚀 Quick Start

### Local Testing

```bash
# Start local server
python3 -m http.server 8000

# Open apps in browser
# User app: http://localhost:8000/index.html
# Admin app: http://localhost:8000/admin.html
```

### User Flow

**For Players:**
1. Open user app: https://badminton-b95ac.web.app/
2. Login with your credentials
3. Register for session with one click
4. Mark as paid when ready
5. Auto-login on future visits

**For Admin:**
1. Open admin app: https://badminton-b95ac.web.app/admin.html
2. Login with admin password
3. Create new session (draft mode)
4. Add regular players if needed
5. Publish session (deducts wallet for unpaid players)
6. Share session announcement to Line
7. Close session when complete

## 📋 Features

### User Features (Both Apps)

- **Login System:** Password-based authentication with auto-login
- **Wallet System:** Track balance, automatic deductions, top-ups
- **Registration:** One-click registration, guest registration
- **Payments:** Self-service payment marking
- **Give 100 Baht:** Help other players with low balance
- **Transactions:** View personal transaction history
- **Real-time Sync:** Firebase Firestore real-time updates
- **Multi-language:** English, Thai, Norwegian

### Admin Features (Admin App Only)

- **Session Management:** Create, publish, close sessions
- **Draft Mode:** Prepare sessions before making them visible
- **Player Management:** Manage regular players by day
- **User Management:** Add/edit/remove authorized users
- **Wallet Management:** Top-up balances, adjust amounts
- **Line Notifications:** Share sessions, nudge unpaid players
- **Reports:** Export lists, generate weekly reports
- **Debug Tools:** View raw Firebase data, transaction history

## 🏗️ Technology Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend:** Firebase Firestore (NoSQL database)
- **Notifications:** Firebase Cloud Functions + Line Messaging API
- **Deployment:** Firebase Hosting
- **Languages:** Trilingual UI (Norwegian, English, Thai)

## 📊 Code Reduction

| Component | Original | User App | Admin App |
|-----------|----------|----------|-----------|
| HTML | 469 lines | 237 lines | 469 lines |
| JavaScript | 7,614 lines | 2,400 lines | 7,614 lines |
| CSS | 1,057 lines | 515 lines | 1,057 lines |
| **Total** | **9,140 lines** | **3,150 lines** | **9,140 lines** |

**User app: 65% code reduction!**

## 🔒 Security

- User passwords stored in Firestore (plain text - consider hashing for production)
- Admin password: `SikkertPassord1955` (only in admin app)
- Firebase Security Rules control data access
- User app does NOT expose admin functionality
- Admin password required for all admin operations

## 📱 Line Notifications

Integrated with Line Messaging API via Firebase Cloud Functions:

- **Session Announcements:** Share new sessions to Line group
- **Cancellation Notices:** Automatic notifications when players cancel
- **Nudge Reminders:** Send reminders to unpaid players
- **Test Functions:** Test notifications before sending to group

See `LINE_NOTIFICATIONS_SETUP.md` for setup instructions.

## 🔧 Development

### File Structure

```
User App:
├── index.html (237 lines)
├── app-user.js (2,400 lines)
└── style-user.css (515 lines)

Admin App:
├── admin.html (469 lines)
├── app-admin.js (7,614 lines)
└── style-admin.css (1,057 lines)

Shared:
├── firebase-config.js
├── manifest.json
└── functions/index.js

Documentation:
├── CLAUDE.md
├── README.md (this file)
├── FIREBASE_SETUP.md
├── LINE_NOTIFICATIONS_SETUP.md
├── DEPLOY_CHECKLIST.md
├── SPLIT_APP_SUMMARY.md
└── TEST_REPORT.md
```

### Adding Features

**User features:**
- Modify: `index.html`, `app-user.js`, `style-user.css`
- Test in user app only

**Admin features:**
- Modify: `admin.html`, `app-admin.js`, `style-admin.css`
- Test in admin app only

**Both apps:**
- Update shared backend (Firebase functions)
- Test both apps for real-time sync

### Deployment

```bash
# 1. Update version numbers in BOTH apps first!

# 2. Commit changes
git add .
git commit -m "Your commit message

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main

# 3. Deploy to Firebase Hosting
firebase deploy --only hosting

# Or deploy everything (hosting + functions):
firebase deploy
```

**Deploys to Firebase Hosting:**
- User app: https://badminton-b95ac.web.app/
- Admin app: https://badminton-b95ac.web.app/admin.html

## 📝 Documentation

- **CLAUDE.md** - Comprehensive development guide
- **FIREBASE_SETUP.md** - Firebase configuration
- **LINE_NOTIFICATIONS_SETUP.md** - Line Bot setup
- **DEPLOY_CHECKLIST.md** - Deployment checklist
- **SPLIT_APP_SUMMARY.md** - Architecture documentation
- **TEST_REPORT.md** - Automated test results

## 🐛 Troubleshooting

**"Error loading app. Please refresh the page."**
- Usually temporary Firebase connection issue
- Refresh page to reconnect
- Check browser console for details

**Auto-login not working:**
- Check if using private/incognito mode (localStorage disabled)
- Clear browser cache and login again
- Verify password hasn't been reset by admin

**Real-time updates not working:**
- Check Firebase connection in console
- Verify Firebase rules allow read access
- Refresh both tabs

**Admin panel not opening:**
- Verify you're using admin app (`admin.html`)
- Check admin password is correct
- Check browser console for errors

## 📞 Support

For issues, questions, or feature requests:
1. Check documentation in `CLAUDE.md`
2. Review test report in `TEST_REPORT.md`
3. Check Firebase Console for backend issues
4. Review browser console for frontend errors

## 🎯 Version

**Current Version:** v2026-01-23 08:45

**Latest Changes:**
- Split app into user and admin versions
- 65% code reduction in user app
- All features preserved in admin app
- Improved security and maintainability

---

**Built with ❤️ using Firebase and vanilla JavaScript**

**Deployed to:** https://badminton-b95ac.web.app/
