# 🔥 Firebase Setup Guide

Follow these steps to set up Firebase for your Badminton app:

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `badminton-signup` (or your choice)
4. Disable Google Analytics (not needed for this app)
5. Click "Create project"

## Step 2: Enable Firestore Database

1. In Firebase Console → Build → Firestore Database
2. Click "Create database"
3. Start in **production mode** (we'll add rules next)
4. Choose location: `asia-southeast1` (Singapore - closest to Thailand)
5. Click "Enable"

## Step 3: Set Up Firestore Security Rules

1. Go to Firestore Database → Rules
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read sessions and authorized users
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if request.auth != null; // Only authenticated users (admin)
    }

    match /sessions/{sessionId}/players/{playerId} {
      allow read: if true;
      allow create: if true; // Anyone can sign up
      allow update: if true; // Anyone can mark themselves as paid
      allow delete: if request.auth != null; // Only admin can delete
    }

    match /authorizedUsers/{userId} {
      allow read: if true; // Need to check if user is authorized
      allow write: if request.auth != null; // Only admin can modify
    }
  }
}
```

3. Click "Publish"

## Step 4: Register Web App

1. In Firebase Console → Project Overview (gear icon) → Project settings
2. Scroll down to "Your apps"
3. Click the **</>** (Web) icon
4. App nickname: `Badminton Web App`
5. Click "Register app"
6. **COPY** the Firebase configuration object

## Step 5: Update firebase-config.js

1. Open `firebase-config.js`
2. Replace the placeholder values with your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "AIza...",              // From Firebase Console
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

## Step 6: Enable Anonymous Authentication (Optional but Recommended)

This allows better security without requiring users to create accounts:

1. Firebase Console → Build → Authentication
2. Click "Get started"
3. Enable "Anonymous" sign-in method
4. Save

## Step 7: Test Your Setup

1. Open `index.html` in a browser
2. Open Developer Console (F12)
3. Check for Firebase connection errors
4. Try signing up a player
5. Check Firestore Database to see if data was saved

## 🎉 Done!

Your app now uses Firebase and data syncs across all devices!

## 📱 Next Steps

- Set up Firebase Admin SDK for SwiftUI app
- Add Firebase to your iOS project
- Use same `projectId` and credentials

## 🆘 Troubleshooting

**Error: "Firebase: No Firebase App '[DEFAULT]' has been created"**
- Make sure `firebase-config.js` is loaded before `app.js` in HTML

**Error: "Missing or insufficient permissions"**
- Check Firestore security rules
- Make sure rules are published

**Data not syncing**
- Check browser console for errors
- Verify internet connection
- Check Firebase Console → Firestore Database for data
