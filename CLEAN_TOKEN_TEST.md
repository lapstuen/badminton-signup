# CLEAN TOKEN TEST - ChatGPT Instructions

## Steg-for-steg:

### 1. Slett BadmintonPlayer fra iPhone
- Hold inne på app-ikonet
- Velg "Remove App" → "Delete App"

### 2. Slett Geir's FCM token fra Firestore
```bash
cd /Users/geirlapstuen/Swift/lineapp
GOOGLE_APPLICATION_CREDENTIALS=/Users/geirlapstuen/Swift/lineapp/serviceAccountKey.json node delete-geir-token.js
```

### 3. Bygg og installer fra Xcode
- Åpne BadmintonWalletManager.xcodeproj
- Velg BadmintonPlayer scheme
- Select iPhone som target
- Cmd+R (Run)

### 4. På iPhone når appen starter:
- Tillat notifications når spurt
- Logg inn som Geir

### 5. Se på Xcode console output
Du skal se noe slikt:

```
📱 AppDelegate: didRegisterForRemoteNotificationsWithDeviceToken
   Bundle ID: no.1955.BadmintonWalletManager.BadmintonPlayer
   APNs Token (hex): 1a2b3c4d5e6f...
   Token length: 64 chars
✅ APNs token forwarded to Firebase Messaging (Messaging.messaging().apnsToken = deviceToken)

🔔 FCM Token received in AppDelegate
   Bundle ID: no.1955.BadmintonWalletManager.BadmintonPlayer
   Install Timestamp: 2026-01-25T04:05:23Z
   FCM Token: cIAQ_4Xq...
   First 25 chars: cIAQ_4XqMk84i1C8HCw4kS
```

### 6. Kopier det nye FCM tokenet
Fra console output, kopier HELE FCM token strengen.

### 7. Test med curl
```bash
cd /Users/geirlapstuen/Swift/lineapp
./test-fix.sh
```

### 8. Forventet resultat

**HVIS FIX FUNGERTE:**
```json
{
  "name": "projects/badminton-b95ac/messages/..."
}
```
→ Du får notification på iPhone ✅

**HVIS FORTSATT FEIL:**
```json
{
  "error": {
    "details": [{
      "@type": "type.googleapis.com/google.firebase.fcm.v1.ApnsError",
      "statusCode": 403,
      "reason": "BadEnvironmentKeyInToken"
    }]
  }
}
```

## Kritiske ting å bekrefte fra logging:

1. ✅ `didRegisterForRemoteNotificationsWithDeviceToken` ble kalt
2. ✅ `Messaging.messaging().apnsToken = deviceToken` ble utført
3. ✅ Bundle ID er: `no.1955.BadmintonWalletManager.BadmintonPlayer`
4. ✅ FCM token ble generert (ikke "nil")
5. ✅ FCM token ble saved to Firestore

Hvis ALT dette er sant og du fortsatt får `BadEnvironmentKeyInToken`, er problemet sannsynligvis:
- APNs key configuration i Firebase Console er feil
- Eller Apple Developer Portal har feil configuration

## Neste steg hvis fortsatt feil:

Lim inn:
1. Full console output fra Xcode
2. curl response
3. Screenshot av Firebase Console APNs configuration

Da kan vi se nøyaktig hva som er galt.
