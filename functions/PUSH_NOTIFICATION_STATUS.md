# Push Notification Status - BadmintonPlayer App

**Sist oppdatert:** 2026-01-24 kl 16:35
**Status:** ❌ IKKE FUNGERENDE - `messaging/third-party-auth-error`

---

## ✅ HVA SOM FUNGERER (BEKREFTET)

### 1. BadmintonPlayer iOS App
- ✅ App kompilerer og kjører uten feil
- ✅ Firebase initialiseres korrekt
- ✅ AppDelegate mottar APNs device token fra iOS
- ✅ Firebase Messaging genererer FCM token
- ✅ FCM token lagres i Firestore: `authorizedUsers/IOpvSebiXW0B3g7ZT1KD`
- ✅ Notification permissions er gitt av bruker
- ✅ Token: `f81Bi9sWk0DYkEFcxok6NQ:APA91bHJHv449Kpa_DxqovUV-qLi3WH_ftA6vitNZMHR7yYfaZMbb4p5mhJ7OrHJRHE-C7DuL7w5wqWa0c7h2DawMwQHMwX89V5o1zhWysJwk7ZUKPxcWEE`

**Logg fra iPhone app:**
```
📱 AppDelegate: Received APNs device token
✅ APNs token forwarded to Firebase Messaging
🔔 FCM Token received: f81Bi9sWk0DYkEFcxok6NQ:APA91b...
💾 Saving FCM token for user: IOpvSebiXW0B3g7ZT1KD
✅ FCM token saved to Firestore for user: IOpvSebiXW0B3g7ZT1KD
✅ Notification permissions granted
```

### 2. Firebase Cloud Functions
- ✅ `onPlayerCreated` trigger fungerer (trigger ved ny spiller)
- ✅ `onPlayerDeleted` trigger fungerer (trigger ved fjernet spiller)
- ✅ Cloud Functions henter FCM tokens fra Firestore korrekt
- ✅ Cloud Functions sender til Telegram (fungerer perfekt)
- ✅ APNs payload er lagt til i FCM melding

**Logg fra Cloud Functions:**
```
➕ New player registered: Demo (position 1) in session current
📱 Sending FCM to 1 user(s)
📱 Telegram sent: true  ← DETTE FUNGERER!
```

### 3. Firebase/Google Cloud Konfigurasjon
- ✅ APNs Authentication Keys er lastet opp til Firebase Console
  - Development key: 6722C7PW8A
  - Production key: 6722C7PW8A
  - Team ID: FMT6QLJK76
- ✅ Firebase Cloud Messaging API er ENABLED i Google Cloud Console
  - URL: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=badminton-b95ac
  - Status: API Enabled
- ✅ Service account har ALLE nødvendige roller (se under)

### 4. Kode Endringer som ER Implementert

#### BadmintonPlayer/BadmintonPlayerApp.swift
```swift
// ✅ LAGT TIL: AppDelegate for å motta APNs token
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }
}

@main
struct BadmintonPlayerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate  // ✅ LAGT TIL
    // ...
}
```

#### Shared/Services/FirebaseManager.swift (linje 2139-2147)
```swift
// ✅ ENDRET: Fra updateData til setData(merge: true)
func saveFCMToken(token: String, userId: String) async throws {
    try await db.collection("authorizedUsers")
        .document(userId)
        .setData(["fcmToken": token], merge: true)  // ✅ FUNGERER
}
```

#### functions/index.js (linje ~1054 og ~1304)
```javascript
// ✅ LAGT TIL: APNs payload i FCM melding
const fcmMessage = {
    notification: { title, body },
    data: { ... },
    apns: {                    // ✅ LAGT TIL
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

#### BadmintonWalletManager.xcodeproj/project.pbxproj
```
// ✅ LAGT TIL: Filer til BadmintonPlayer target membershipExceptions
membershipExceptions = (
    Assets.xcassets,
    BadmintonPlayer.entitlements,
    BadmintonPlayerApp.swift,
    GoogleService-Info.plist,
    Utils/AuthenticationManager.swift,
    Utils/NotificationManager.swift,
    Views/*.swift  // Alle view filer
);
```

---

## ❌ HVA SOM IKKE FUNGERER

### Cloud Functions FCM Sending
**Feil:** `messaging/third-party-auth-error`

**Logg fra Cloud Functions:**
```
✅ FCM sent: 0 success, 1 failed
❌ FCM failed for token 0: messaging/third-party-auth-error
   Request is missing required authentication credential.
   Expected OAuth 2 access token, login cookie or other valid authentication credential.
```

**Dette betyr:** Cloud Functions kan IKKE sende FCM meldinger til iOS enheter.

---

## 🔍 HVA SOM ER BEKREFTET/TESTET

### Google Cloud IAM Permissions (BEKREFTET 2026-01-24 kl 16:25)

**Service Account:** `667668341395-compute@developer.gserviceaccount.com`
**Roller (ALLE er lagt til):**
- ✅ Cloud Run Invoker
- ✅ Editor
- ✅ Eventarc Event Receiver
- ✅ Firebase Admin SDK Administrator Service Agent
- ✅ Firebase Cloud Messaging API Admin

**URL:** https://console.cloud.google.com/iam-admin/iam?project=badminton-b95ac

### Andre Service Accounts i prosjektet:
1. `firebase-adminsdk-fbsvc@badminton-b95ac.iam.gserviceaccount.com`
   - Rolle: Firebase Admin SDK Administrator Service Agent
   - Rolle: Service Account Token Creator

2. `badminton-b95ac@appspot.gserviceaccount.com`
   - Rolle: Editor

### Firebase Admin SDK Initialisering
```javascript
// index.js linje 14
admin.initializeApp();  // ✅ KORREKT - bruker default credentials
```

### Firebase Functions Deployment
**Siste deployment:** 2026-01-24 kl 16:30
```bash
firebase deploy --only functions:onPlayerCreated,functions:onPlayerDeleted
✔ Deploy complete!
```

### FCM Token Format
Token som er lagret i Firestore:
```
f81Bi9sWk0DYkEFcxok6NQ:APA91bHJHv449Kpa_DxqovUV-qLi3WH_ftA6vitNZMHR7yYfaZMbb4p5mhJ7OrHJRHE-C7DuL7w5wqWa0c7h2DawMwQHMwX89V5o1zhWysJwk7ZUKPxcWEE
```
- ✅ Format er korrekt (starter med base64 → `:APA91b` → resten av token)
- ✅ Token er ikke utløpt (generert i dag)

---

## 🚫 HVA SOM IKKE ER PROBLEMET

Disse tingene har vi **BEKREFTET** at IKKE er problemet:

1. ❌ Manglende APNs credentials - **ER lastet opp**
2. ❌ FCM API ikke enabled - **ER enabled**
3. ❌ Manglende service account permissions - **ALLE roller er lagt til**
4. ❌ Feil i iOS app kode - **FCM token genereres og lagres korrekt**
5. ❌ Manglende AppDelegate - **ER implementert**
6. ❌ Manglende APNs payload - **ER lagt til i FCM melding**
7. ❌ Cloud Functions ikke deployed - **ER redeployed flere ganger**
8. ❌ Ugyldig FCM token format - **Token format er korrekt**

---

## 🔎 MULIGE ÅRSAKER SOM GJENSTÅR

### 1. Service Account Mismatch
**Hypotese:** Cloud Functions kjører med en service account, men Firebase Messaging trenger en ANNEN service account.

**Test:** Sjekk om `firebase-adminsdk-fbsvc@badminton-b95ac.iam.gserviceaccount.com` burde brukes istedenfor `667668341395-compute@developer.gserviceaccount.com`.

### 2. OAuth 2.0 Access Token
**Hypotese:** FCM HTTP v1 API krever OAuth 2.0 access token, ikke bare service account rolle.

**Fra feilmelding:** `Expected OAuth 2 access token, login cookie or other valid authentication credential`

**Test:** Må kanskje eksplisitt generere OAuth token i Cloud Functions kode.

### 3. Firebase Project Configuration
**Hypotese:** Det kan være en mismatch mellom:
- Firebase project ID i `GoogleService-Info.plist` (BadmintonPlayer app)
- Firebase project ID i Cloud Functions
- Google Cloud project som APNs keys er lastet opp til

**Test:** Verifiser at ALLE bruker samme prosjekt: `badminton-b95ac`

### 4. APNs Environment Mismatch
**Hypotese:** App kjører i development mode, men APNs keys er konfigurert for production (eller omvendt).

**Test:** Sjekk om BadmintonPlayer app bygges med Development provisioning profile vs Production.

### 5. Firebase Admin SDK Version
**Hypotese:** `firebase-admin` pakken i Cloud Functions kan være utdatert.

**Nåværende versjon:** `firebase-admin: ^13.5.0`
**Test:** Oppgrader til nyeste versjon.

### 6. Region Mismatch
**Hypotese:** Cloud Functions kjører i `us-central1`, Firestore er i `asia-southeast1`.

**Fra deployment logs:**
```
trigger_region: asia-southeast1
function region: us-central1
```

**Test:** Dette kan påvirke auth.

---

## 📝 NESTE STEG Å UNDERSØKE (i morgen)

### Prioritet 1: Sjekk Service Account som FAKTISK brukes
```bash
# I Cloud Functions logs, se etter hvilken service account som faktisk brukes
# Sammenlign med hvilken som HAR permissions
```

### Prioritet 2: Test med Eksplisitt OAuth Token
Endre `index.js` til å eksplisitt generere OAuth 2.0 token:
```javascript
const {google} = require('googleapis');
// Generer OAuth token og bruk i FCM request
```

### Prioritet 3: Verifiser Firebase Project Consistency
```bash
# Sjekk at GoogleService-Info.plist i BadmintonPlayer matcher
# Firebase project i Cloud Functions
```

### Prioritet 4: Test FCM Sending fra Lokal Maskin
Skriv et test-script som kjører LOKALT (ikke i Cloud Functions) for å se om FCM sending fungerer:
```javascript
// test_fcm_local.js - kjør med firebase-admin lokalt
```

### Prioritet 5: Sjekk Firebase Console Notifications Settings
Gå til Firebase Console → Project Settings → Cloud Messaging
Verifiser at APNs certificates/keys er AKTIVE (ikke utløpt).

---

## 📚 REFERANSER

### Firebase Dokumentasjon
- [FCM HTTP v1 API Authentication](https://firebase.google.com/docs/cloud-messaging/auth-server) (oppdatert 2026-01-22)
- [FCM Error Codes](https://firebase.google.com/docs/cloud-messaging/error-codes) (oppdatert 2026-01-22)
- [Firebase Cloud Messaging roles and permissions](https://cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging)

### GitHub Issues (lignende problemer)
- [Unable to send FCM to Firefox - Auth error](https://github.com/firebase/firebase-js-sdk/issues/6523)
- [Cloud function PERMISSION_DENIED](https://github.com/firebase/firebase-functions/issues/1425)
- [firebase-admin upgrade requires serviceUsageConsumer](https://github.com/firebase/firebase-admin-node/issues/2658)

---

## 🛠️ VIKTIGE KOMMANDOER

### Se Cloud Functions Logs
```bash
cd /Users/geirlapstuen/Swift/lineapp/functions
firebase functions:log --only onPlayerCreated | head -30
firebase functions:log --only onPlayerDeleted | head -30
```

### Redeploy Cloud Functions
```bash
cd /Users/geirlapstuen/Swift/lineapp/functions
firebase deploy --only functions:onPlayerCreated,functions:onPlayerDeleted
```

### Sjekk Firebase Project
```bash
firebase projects:list
firebase use badminton-b95ac
```

---

## 📞 KONTAKTINFO TIL TEAM

**Project ID:** badminton-b95ac
**Project Number:** 667668341395
**Google Cloud Console:** https://console.cloud.google.com/home/dashboard?project=badminton-b95ac
**Firebase Console:** https://console.firebase.google.com/project/badminton-b95ac/overview

---

## ⏱️ TIDSBRUK

**Total tid på push notification fix:** ~6 timer (2026-01-24)
- 1 time: Fikse kompilering errors (SUCCESS ✅)
- 5 timer: Fikse FCM sending (IKKE LØST ❌)

**Forventet tid:** 15 minutter (bruker sa)
**Faktisk tid:** 6 timer og fortsetter

---

**VIKTIG:** Dette dokumentet oppdateres hver gang vi prøver noe nytt.
Ikke slett informasjon - legg bare til nye funn under riktig seksjon.
