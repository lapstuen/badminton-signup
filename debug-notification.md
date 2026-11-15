# Debug: FCM Success men ingen notification

## Sjekkliste:

### 1. Verifiser app installasjon
På iPhone:
- Slett ALLE versjoner av BadmintonPlayer (Xcode OG TestFlight)
- Åpne TestFlight app
- Install BadmintonPlayer FRA TestFlight
- Verifiser at det står "TestFlight" badge på app-ikonet

### 2. Verifiser notification permissions
Når appen starter:
- Tillat notifications når spurt
- Gå til iPhone Settings → Notifications → BadmintonPlayer
- Sjekk at:
  - ✅ Allow Notifications er ON
  - ✅ Lock Screen er ON
  - ✅ Notification Center er ON
  - ✅ Banners er ON

### 3. Hent NYTT token fra TestFlight-appen
- Åpne appen
- Logg inn som Geir
- Sjekk Console app på Mac (velg iPhone, filter "BadmintonPlayer")
- Se etter FCM token i output

### 4. Generer nytt token
```bash
# Slett gammelt token
GOOGLE_APPLICATION_CREDENTIALS=/Users/geirlapstuen/Swift/lineapp/serviceAccountKey.json node delete-geir-token.js

# Kill app på iPhone (swipe up)
# Åpne app på nytt
# Logg inn

# Hent nytt token
GOOGLE_APPLICATION_CREDENTIALS=/Users/geirlapstuen/Swift/lineapp/serviceAccountKey.json node get-geir-token.js
```

### 5. Test med enklere payload
Prøv uten APNs-specific config først.

