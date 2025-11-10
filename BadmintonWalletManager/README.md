# 💰 Badminton Wallet Manager

A native iOS/iPadOS app for managing user wallets in the Badminton registration system. Built with SwiftUI and Firebase Firestore for real-time data synchronization.

## Features

✨ **Real-time Wallet Management**
- View all users and their current balance
- Color-coded balance indicators (Low/Medium/High)
- Search users instantly
- Real-time updates across all devices

💵 **Quick Top-ups**
- Fast top-up buttons (150, 300, 450, 600 THB)
- Custom amount entry
- Automatic transaction recording
- Balance deduction support

📊 **Transaction History**
- View individual user transactions
- Browse all transactions across users
- Search and filter transactions
- Timestamped records with descriptions

🔐 **User Management**
- Edit user passwords
- Delete users (with confirmation)
- View user details

## Requirements

- iOS 16.0+ / iPadOS 16.0+ / macOS 13.0+
- Xcode 15.0+
- Swift 5.9+
- Firebase account

## Setup Instructions

### 1. Create Xcode Project

1. Open Xcode
2. File → New → Project
3. Choose **iOS** → **App**
4. Product Name: `BadmintonWalletManager`
5. Interface: **SwiftUI**
6. Language: **Swift**
7. Save to: `/Users/geirlapstuen/Swift/lineapp/`

### 2. Add Firebase SDK

1. In Xcode, File → Add Package Dependencies
2. Enter URL: `https://github.com/firebase/firebase-ios-sdk`
3. Click **Add Package**
4. Select these products:
   - ✅ FirebaseFirestore
   - ✅ FirebaseAuth (optional, for future authentication)
5. Click **Add Package**

### 3. Download Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **badminton-signup**
3. Click ⚙️ Settings → Project Settings
4. Scroll to "Your apps" section
5. Click **Add app** → iOS (🍎)
6. Fill in:
   - **iOS bundle ID**: `no.geirlapstuen.BadmintonWalletManager` (or your bundle ID)
   - **App nickname**: `Badminton Wallet Manager`
7. Click **Register app**
8. Download `GoogleService-Info.plist`
9. **IMPORTANT**: Drag this file into your Xcode project (root level)
   - ✅ Make sure "Copy items if needed" is checked
   - ✅ Make sure target is selected

### 4. Add Source Files

Copy all the Swift files from this directory into your Xcode project:

```
BadmintonWalletManager/
├── BadmintonWalletManagerApp.swift  (Main app entry point)
├── Models/
│   ├── User.swift                   (User model)
│   └── Transaction.swift            (Transaction model)
├── Services/
│   └── FirebaseManager.swift        (Firebase service)
└── Views/
    ├── ContentView.swift             (Main user list)
    ├── UserDetailView.swift          (User detail & wallet management)
    └── TransactionHistoryView.swift  (Transaction views)
```

**How to add files to Xcode:**

1. In Xcode, right-click on your project in the Navigator
2. Choose **Add Files to "BadmintonWalletManager"...**
3. Select all Swift files from this directory
4. ✅ Make sure "Copy items if needed" is checked
5. ✅ Make sure "Add to targets" includes your app target
6. Click **Add**

### 5. Update Firebase Security Rules

Go to [Firebase Console](https://console.firebase.google.com/) → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write to authorized users
    match /authorizedUsers/{userId} {
      allow read: if true;
      allow write: if true;
    }

    // Allow read/write to transactions
    match /transactions/{transId} {
      allow read: if true;
      allow write: if true;
    }

    // Allow read to sessions (optional)
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

**IMPORTANT**: For production, you should add proper authentication rules!

### 6. Configure App Info.plist

The app needs no special permissions, but you may want to add:

1. Select `Info.plist` in Xcode
2. Add these keys (optional):
   - `CFBundleDisplayName`: `Wallet Manager`
   - `UILaunchScreen`: (for custom launch screen)

### 7. Build and Run

1. Select your target device (iPhone/iPad simulator or real device)
2. Press `Cmd + R` to build and run
3. The app should launch and connect to Firebase
4. Check Xcode console for Firebase connection logs:
   ```
   🔥 Firebase configured successfully
   🔥 Setting up real-time listeners...
   ✅ Loaded X users
   ```

## Project Structure

```
BadmintonWalletManager/
│
├── App/
│   └── BadmintonWalletManagerApp.swift   # App entry point, Firebase config
│
├── Models/
│   ├── User.swift                        # User data model
│   └── Transaction.swift                 # Transaction data model
│
├── Services/
│   └── FirebaseManager.swift             # Firebase service layer
│       ├── Real-time user listeners
│       ├── Balance management
│       ├── Transaction recording
│       └── User CRUD operations
│
└── Views/
    ├── ContentView.swift                 # Main screen
    │   ├── User list with search
    │   ├── Balance summary
    │   └── Navigation to details
    │
    ├── UserDetailView.swift              # User detail screen
    │   ├── Balance display
    │   ├── Quick top-up buttons
    │   ├── Custom amount entry
    │   ├── Deduction support
    │   └── Edit user (password, delete)
    │
    └── TransactionHistoryView.swift      # Transaction screens
        ├── User transactions
        └── All transactions (admin view)
```

## Usage Guide

### Managing Wallets

1. **View Users**
   - Launch app to see all users
   - Search using the search bar
   - Users are sorted alphabetically

2. **Top-up Balance**
   - Tap on a user
   - Use quick buttons (150, 300, 450, 600) or enter custom amount
   - Add optional description
   - Tap "Add to Balance"
   - Success! ✅

3. **Deduct Balance**
   - Tap on a user
   - Enter amount and description
   - Tap "Deduct from Balance"
   - Useful for manual adjustments

4. **View Transactions**
   - Tap "View Transaction History" in user detail
   - See all top-ups and deductions
   - Timestamps and descriptions included

5. **Edit User**
   - Tap user → scroll to "Danger Zone"
   - Change password or delete user

### Balance Color Indicators

- 🔴 **Red** (< 150 THB): Low balance, needs top-up
- 🟠 **Orange** (150-449 THB): Medium balance
- 🟢 **Green** (450+ THB): Healthy balance

## Data Synchronization

The app uses **real-time listeners**, meaning:

✅ Changes in the web app appear instantly in iOS app
✅ Changes in iOS app appear instantly in web app
✅ Multiple devices stay in sync automatically
✅ Works offline with automatic sync when online

## Firestore Collections Used

### `authorizedUsers`
```javascript
{
  name: string,
  balance: number,
  password: string,
  role: string (optional),
  regularDays: array (optional),
  createdAt: timestamp
}
```

### `transactions`
```javascript
{
  userId: string,
  userName: string,
  amount: number,        // Positive = credit, Negative = debit
  description: string,
  timestamp: timestamp
}
```

## Troubleshooting

### "Firebase not configured" error

**Solution**: Make sure `GoogleService-Info.plist` is added to your Xcode project and included in the target.

### Users not loading

**Solution**:
1. Check Firebase security rules allow read access
2. Check Xcode console for error messages
3. Verify Firebase project ID in `GoogleService-Info.plist`

### Real-time updates not working

**Solution**:
1. Check internet connection
2. Check Firebase console for outages
3. Try restarting the app

### Build errors with Firebase

**Solution**:
1. Clean build folder: `Cmd + Shift + K`
2. Delete derived data: `Cmd + Shift + Option + K`
3. Restart Xcode

## Future Enhancements

Ideas for future versions:

🔐 Add Firebase Authentication for secure login
📊 Add charts/graphs for balance trends
🔔 Push notifications for low balance alerts
📧 Email receipts for transactions
🌍 Multi-language support (Thai/Norwegian)
🎨 Dark mode support
📱 iPad-optimized layout with split view
💾 Export transactions to CSV

## Security Considerations

⚠️ **Important for Production:**

1. **Authentication**: Add Firebase Authentication to restrict access
2. **Security Rules**: Update Firestore rules to require authentication
3. **Password Storage**: Consider hashing passwords (currently plain text)
4. **User Roles**: Implement role-based access control
5. **API Keys**: Consider using App Check for API key protection

## Contributing

This app shares the same Firebase database as the web app at:
https://lapstuen.github.io/badminton-signup/

Changes in either app will be reflected in the other in real-time.

## License

Private project for Badminton session management.

---

**Created with ❤️ by Claude Code**
Version 1.0.0 - November 2025
