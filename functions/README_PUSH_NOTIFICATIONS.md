# Push Notifications Dokumentasjon

**Status:** ❌ IKKE FUNGERENDE
**Sist oppdatert:** 2026-01-24

---

## 📄 VIKTIG DOKUMENTASJON

**Start her i morgen:**
👉 [PUSH_NOTIFICATION_STATUS.md](PUSH_NOTIFICATION_STATUS.md)

Denne filen inneholder:
- ✅ Alt som fungerer (BadmintonPlayer app, FCM token, Cloud Functions)
- ❌ Hva som ikke fungerer (`messaging/third-party-auth-error`)
- 🔍 Alt som er bekreftet/testet (APNs keys, IAM roller, Firebase config)
- 🔎 Mulige årsaker som gjenstår (6 hypoteser å teste)
- 📝 Neste steg å undersøke (prioritert liste)

---

## ⚡ QUICK REFERENCE

### Feilmelding
```
❌ FCM failed for token 0: messaging/third-party-auth-error
Request is missing required authentication credential.
Expected OAuth 2 access token, login cookie or other valid authentication credential.
```

### Hva som ER fikset
1. ✅ BadmintonPlayer app kompilerer
2. ✅ AppDelegate mottar APNs token
3. ✅ FCM token genereres og lagres i Firestore
4. ✅ Cloud Functions trigger korrekt
5. ✅ APNs keys lastet opp til Firebase
6. ✅ FCM API enabled i Google Cloud
7. ✅ Service account har ALLE nødvendige roller
8. ✅ APNs payload lagt til i FCM melding

### Hva som IKKE fungerer
- ❌ Cloud Functions kan ikke sende FCM til iOS enheter
- Får auth error selv med alle permissions

### Neste steg (i morgen)
1. Sjekk hvilken service account som FAKTISK brukes av admin.messaging()
2. Test med eksplisitt OAuth 2.0 token
3. Verifiser Firebase project consistency
4. Test FCM sending fra lokal maskin (ikke Cloud Functions)
5. Sjekk APNs environment (dev vs prod)

---

## 📞 KONTAKT

**Prosjekt:** badminton-b95ac
**Console:** https://console.firebase.google.com/project/badminton-b95ac/overview

**Filer:**
- Status: `PUSH_NOTIFICATION_STATUS.md` (komplett oversikt)
- Historikk: `NOTIFICATION_FIX_CONTEXT.md` (alle forsøk)
- Dette: `README_PUSH_NOTIFICATIONS.md` (quick reference)

---

**IKKE SLETT DENNE MAPPEN** - inneholder all dokumentasjon om push notification problemet.
