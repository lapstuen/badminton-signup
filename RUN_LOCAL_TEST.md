# Lokal FCM Test - Instruksjoner

## Steg 1: Last ned Service Account Key

1. Gå til Firebase Console:
   https://console.firebase.google.com/project/badminton-b95ac/settings/serviceaccounts/adminsdk

2. Klikk **"Generate new private key"**

3. Klikk **"Generate key"** (vil laste ned en .json fil)

4. Flytt filen til lineapp-mappen og gi den nytt navn:
   ```bash
   cd /Users/geirlapstuen/Swift/lineapp
   mv ~/Downloads/badminton-b95ac-*.json ./serviceAccountKey.json
   ```

5. **VIKTIG:** Denne filen inneholder secrets - ALDRI commit til git!
   (Den er allerede i .gitignore)

---

## Steg 2: Kjør Test-Scriptet

```bash
cd /Users/geirlapstuen/Swift/lineapp
node test-fcm-local.js
```

---

## Hva skjer?

Scriptet sender en FCM test-melding **direkte fra din Mac** (ikke via Cloud Functions).

### Hvis det LYKKES (✅):
```
✅ SUCCESS!
Message ID: projects/badminton-b95ac/messages/...

🎉 KONKLUSJON: Problemet ER i Cloud Functions environment!
```

**Dette betyr:**
- Firebase/APNs konfigurasjon er KORREKT
- Problemet er i Cloud Functions service account permissions
- Løsning: Gi Cloud Functions service account riktige IAM roller

---

### Hvis det FEILER (❌):
```
❌ FAILED!
Error code: messaging/third-party-auth-error

🔍 KONKLUSJON: Problemet ER i Firebase/APNs konfigurasjon!
```

**Dette betyr:**
- APNs key i Firebase Console er feil konfigurert
- Mulige årsaker:
  1. APNs key er korrupt
  2. Team ID/Key ID mismatch
  3. Apple har ikke propagert keyen ennå
- Løsning: Lag NY APNs key i Apple Developer Portal

---

## Hva nå?

Kjør scriptet og del resultatet her. Da vet vi endelig hvor problemet er!
