# Test med nytt FCM token

## Steg for å generere nytt token:

1. **Slett appen fra iPhone**
   - Hold inne på BadmintonPlayer app
   - Velg "Remove App" → "Delete App"

2. **Slett token fra Firestore**
   ```bash
   cd /Users/geirlapstuen/Swift/lineapp
   node delete-geir-token.js
   ```

3. **Bygg og installer appen på nytt fra Xcode**
   - Dette genererer et helt nytt FCM token med den nye APNs key-konfigurasjonen

4. **Test med nytt token**
   ```bash
   ./test-fix.sh
   ```

## Alternativt: Vent 5-10 minutter

Firebase kan ha cache/CDN delay når nye APNs keys lastes opp.
Test om noen minutter med eksisterende token:

```bash
./test-fix.sh
```
