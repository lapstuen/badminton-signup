# Push Notification Fix - Context Log

## Problem Solved
BadmintonPlayer app skulle motta push notifications når admin legger til/fjerner spillere i "Manage Today's Players".

## Fixes Implemented

### 1. BadmintonPlayerApp.swift - Added AppDelegate
**File:** `/Users/geirlapstuen/Swift/BadmintonWalletManager/BadmintonPlayer/BadmintonPlayerApp.swift`

Added AppDelegate class to receive APNs token from iOS:
- `didRegisterForRemoteNotificationsWithDeviceToken` - receives APNs token
- Forwards to Firebase Messaging: `Messaging.messaging().apnsToken = deviceToken`
- Added `@UIApplicationDelegateAdaptor(AppDelegate.self)` to BadmintonPlayerApp

**Why:** Pure SwiftUI app had no delegate to receive APNs token. Without APNs token, Firebase can't generate FCM token.

### 2. FirebaseManager.swift - Fixed saveFCMToken()
**File:** `/Users/geirlapstuen/Swift/BadmintonWalletManager/Shared/Services/FirebaseManager.swift` (line 2139-2147)

Changed from:
```swift
.updateData(["fcmToken": token])
```

To:
```swift
.setData(["fcmToken": token], merge: true)
```

**Why:** `.updateData()` throws exception if document doesn't exist. `.setData(merge: true)` creates or updates.

### 3. project.pbxproj - Added Files to Build
**File:** `BadmintonWalletManager.xcodeproj/project.pbxproj`

Added to membershipExceptions for BadmintonPlayer target:
- Assets.xcassets (icons)
- BadmintonPlayer.entitlements (push capabilities)
- GoogleService-Info.plist (Firebase config)
- All Utils/*.swift files
- All Views/*.swift files

**Why:** fileSystemSynchronizedRootGroup with membershipExceptions acts as whitelist - only listed files are compiled.

## Current Status

✅ **Working:**
- BadmintonPlayer app compiles
- Firebase initializes
- APNs token received from iOS
- FCM token generated: `f81Bi9sWk0DYkEFcxok6NQ:APA91b...`
- FCM token saved to Firestore for user: `IOpvSebiXW0B3g7ZT1KD`
- Cloud Functions trigger correctly

❌ **Not Working:**
- Cloud Functions fail to send FCM with error:
  ```
  messaging/third-party-auth-error
  Request is missing required authentication credential
  ```

## APNs Configuration (CONFIRMED CONFIGURED)
User has verified APNs Authentication Keys ARE uploaded to Firebase:
- Development key: 6722C7PW8A / Team: FMT6QLJK76
- Production key: 6722C7PW8A / Team: FMT6QLJK76

## Firebase Cloud Messaging API (CONFIRMED ENABLED)
User has verified FCM API IS ENABLED in Google Cloud Console:
- URL: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=badminton-b95ac
- Status: ✅ API Enabled (verified 2026-01-24)
- Service name: fcm.googleapis.com

## FORSØK PÅ FIX #3 (2026-01-24 16:10) - FUNGERTE IKKE

**Hypotese:** FCM messages til iOS enheter KREV APNs payload for å fungere.

**Fix forsøkt:** La til `apns` payload i begge Cloud Functions:

```javascript
const fcmMessage = {
    notification: { title, body },
    data: { ... },
    apns: {                    // ← LAGT TIL
        payload: {
            aps: {
                alert: { title, body },
                sound: 'default',
                badge: 1
            }
        }
    },
    tokens: tokens
};
```

**Resultat:** ❌ FUNGERTE IKKE
- Fortsatt samme feil: `messaging/third-party-auth-error`
- APNs payload er nødvendig, men løste ikke auth problemet

## FORSØK PÅ FIX #4 (2026-01-24 16:25) - FUNGERTE IKKE

**Hypotese:** Service account mangler "Firebase Cloud Messaging API Admin" rolle.

**Fix forsøkt:** La til rolle i Google Cloud IAM:
- Service account: `667668341395-compute@developer.gserviceaccount.com`
- Rolle lagt til: "Firebase Cloud Messaging API Admin"

**Resultat:** ❌ FUNGERTE IKKE
- Redeployed Cloud Functions etter rolle ble lagt til
- Fortsatt samme feil: `messaging/third-party-auth-error`

## KONKLUSJON ETTER 6 TIMER (2026-01-24 16:35)

**Problemet er IKKE løst.**

Se fullstendig dokumentasjon i:
`/Users/geirlapstuen/Swift/lineapp/functions/PUSH_NOTIFICATION_STATUS.md`

Denne filen inneholder:
- ✅ Alt som fungerer
- ❌ Alt som ikke fungerer
- 🔍 Alt som er bekreftet/testet
- 🔎 Mulige årsaker som gjenstår
- 📝 Neste steg å undersøke

## Cloud Functions Location
- File: `/Users/geirlapstuen/Swift/lineapp/functions/index.js`
- onPlayerCreated: line 1218
- onPlayerDeleted: line 971

Both use: `admin.messaging().sendEachForMulticast(fcmMessage)`

## DO NOT ASK AGAIN
- ❌ Don't ask to check Firebase Console configurations - user has already done this
- ❌ Don't ask to upload APNs certificates - they are already configured
- ❌ Don't ask to enable push notifications in Xcode - already enabled
- ✅ Focus on code fixes and Cloud Functions deployment

## Date
2026-01-24
