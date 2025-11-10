# 🚀 Quick Start Guide

Get up and running in 10 minutes!

## Step 1: Create Xcode Project (2 min)

1. Open Xcode
2. File → New → Project
3. iOS → App
4. Name: `BadmintonWalletManager`
5. Interface: **SwiftUI**
6. Language: **Swift**
7. Save to: `/Users/geirlapstuen/Swift/lineapp/`

## Step 2: Add Firebase SDK (3 min)

1. File → Add Package Dependencies
2. URL: `https://github.com/firebase/firebase-ios-sdk`
3. Select: **FirebaseFirestore** ✅
4. Add Package

## Step 3: Get Firebase Config (2 min)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. ⚙️ Settings → Add app → iOS
4. Bundle ID: `no.geirlapstuen.BadmintonWalletManager`
5. Download **GoogleService-Info.plist**
6. **Drag file into Xcode** (root level, check "Copy items")

## Step 4: Add Source Code (2 min)

In Xcode:
1. Right-click project → Add Files
2. Select all `.swift` files from this directory
3. ✅ Copy items if needed
4. ✅ Add to targets
5. Add

## Step 5: Run! (1 min)

1. Select iPhone simulator
2. Press **Cmd + R**
3. Watch for console output:
   ```
   🔥 Firebase configured successfully
   ✅ Loaded X users
   ```

## Done! 🎉

You now have a native iOS app that shares the same database as your web app!

## Quick Tips

- Search users: Pull down on list
- Top-up: Tap user → use quick buttons
- View all transactions: List icon in top right
- Edit user: Tap user → scroll to "Danger Zone"

## Troubleshooting

**Users not loading?**
- Check `GoogleService-Info.plist` is in project
- Check Firebase rules allow read access
- Check console for errors

**Build errors?**
- Clean build: `Cmd + Shift + K`
- Restart Xcode

---

Need help? Check the full README.md for detailed instructions.
