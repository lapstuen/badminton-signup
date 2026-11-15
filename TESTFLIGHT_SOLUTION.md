# TestFlight Production Test

## Problemet
- Development signing → Development APNs token
- Firebase har BEGGE Development og Production keys
- FCM prøver kanskje Production key først
- Mismatch → BadEnvironmentKeyInToken

## Løsning: Tving Production hele veien

### Steg 1: Archive og Export
1. Xcode → Product → Archive
2. Distribute App → App Store Connect
3. Upload til TestFlight

### Steg 2: Install fra TestFlight
1. Slett BadmintonPlayer fra iPhone
2. Install TestFlight app fra App Store
3. Install BadmintonPlayer fra TestFlight
4. Logg inn som Geir

### Steg 3: Test
Med TestFlight får du:
- Production signing
- Production APNs token
- Production FCM routing

Da skal notifications fungere.

---

## Alternativ: Slett Production APNs key midlertidig

Hvis du vil teste Xcode-bygget med KUN Development:

1. Firebase Console → BadmintonPlayer app
2. **Slett Production APNs auth key** (behold kun Development)
3. Slett app fra iPhone
4. Slett FCM token: `GOOGLE_APPLICATION_CREDENTIALS=.../serviceAccountKey.json node delete-geir-token.js`
5. Install fra Xcode
6. Test: `./test-fix.sh`

Hvis dette fungerer → problemet var FCM routing når begge keys eksisterer.
