# TestFlight Build og Test - Steg-for-steg

## Del 1: Archive i Xcode

### 1. Forbered prosjektet
- Åpne BadmintonWalletManager.xcodeproj
- Velg **BadmintonPlayer** scheme (ikke Wallet)
- Velg target: **Any iOS Device (arm64)** (ikke simulator)

### 2. Sjekk versjon/build number
- Klikk på prosjektet i navigator
- Velg BadmintonPlayer target
- Under "General" tab:
  - Version: 1.0 (eller høyere)
  - Build: må være høyere enn forrige TestFlight build
  - Hvis du ikke husker: øk til f.eks. 100

### 3. Archive
- Menu: **Product → Archive**
- Vent mens Xcode bygger (kan ta 1-5 minutter)
- Når ferdig: Organizer vindu åpnes automatisk

---

## Del 2: Upload til TestFlight

### 4. I Organizer vindu
- Du skal se den nye arkivet listet
- Klikk **Distribute App**

### 5. Distribution method
- Velg: **App Store Connect**
- Klikk **Next**

### 6. Destination
- Velg: **Upload**
- Klikk **Next**

### 7. App Store Connect distribution options
- ✅ Upload symbols (anbefalt)
- ✅ Manage version and build number (hvis du vil)
- Klikk **Next**

### 8. Re-signing (automatisk)
- Xcode velger riktig signing automatisk
- Klikk **Next**

### 9. Review og Upload
- Se gjennom informasjonen
- Klikk **Upload**
- Vent (1-5 minutter)

### 10. Når upload er ferdig
- Klikk **Done**
- Gå til App Store Connect: https://appstoreconnect.apple.com

---

## Del 3: Aktiver i TestFlight

### 11. App Store Connect
- Velg **BadmintonPlayer** app
- Gå til **TestFlight** tab
- Under "Builds" → "iOS" skal du se den nye bygget

### 12. Vent på processing
- Status: "Processing" → "Ready to Submit" (5-10 minutter)
- Du får email når ferdig

### 13. Legg til Internal Testers (hvis ikke allerede gjort)
- Gå til "Internal Testing" → "Default Group"
- Klikk **+** ved testers
- Legg til din egen email/Apple ID
- Klikk **Add**

### 14. Start testing
- Velg bygget du nettopp lastet opp
- Klikk **Start Testing**

---

## Del 4: Install på iPhone

### 15. Install TestFlight app
- Hvis ikke allerede installert: Last ned "TestFlight" fra App Store

### 16. Åpne TestFlight app
- Logg inn med samme Apple ID som du la til som tester
- Du skal se **BadmintonPlayer** under "Apps"

### 17. Install app
- Klikk på BadmintonPlayer
- Klikk **Install** eller **Update**
- Vent på nedlasting/installasjon

### 18. Slett gammel app først (viktig!)
- Slett den gamle Xcode-installerte BadmintonPlayer
- Install den nye fra TestFlight

---

## Del 5: Test Push Notifications

### 19. Slett FCM token fra Firestore
```bash
cd /Users/geirlapstuen/Swift/lineapp
GOOGLE_APPLICATION_CREDENTIALS=/Users/geirlapstuen/Swift/lineapp/serviceAccountKey.json node delete-geir-token.js
```

### 20. Åpne appen
- Start BadmintonPlayer fra TestFlight
- Tillat notifications
- Logg inn som Geir

### 21. Verifiser i Console
Åpne Console app på Mac:
- Velg din iPhone
- Filter: "BadmintonPlayer"
- Se etter:
  ```
  📱 AppDelegate: didRegisterForRemoteNotificationsWithDeviceToken
  ✅ APNs token forwarded to Firebase Messaging
  🔔 FCM Token received in AppDelegate
  ✅ FCM token saved to Firestore
  ```

### 22. Test med curl
```bash
./test-fix.sh
```

### 23. Forventet resultat
✅ **SUCCESS:**
```json
{
  "name": "projects/badminton-b95ac/messages/..."
}
```
→ Du får notification på iPhone! 🎉

❌ **Hvis fortsatt feil:**
→ Lim inn curl response og Console output, så undersøker vi videre.

---

## Troubleshooting

**"No account for team..."**
- Du må ha Developer Program membership ($99/år)
- Eller bruke en annen Apple ID som har

**"Build already exists"**
- Øk Build number i Xcode
- Archive på nytt

**"App ikke synlig i TestFlight"**
- Vent 5-10 minutter på processing
- Sjekk email for godkjenning

**"Cannot install TestFlight app"**
- Du må ha riktig Apple ID
- Samme som brukes i App Store Connect
