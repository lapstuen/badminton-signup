# APNs Key Verification Checklist

Siden vi fortsatt får `BadEnvironmentKeyInToken` selv med nytt token, er problemet sannsynligvis i APNs key konfigurasjonen.

## Sjekk Apple Developer Portal

Gå til: https://developer.apple.com/account/resources/authkeys/list

### Finn nøkkelen: 6722C7PW8A

1. **Klikk på nøkkelen for å se detaljer**

2. **Verifiser at "Apple Push Notifications service (APNs)" er enabled**
   - Hvis IKKE: Dette er problemet! Nøkkelen må ha APNs aktivert.

3. **Sjekk at Team ID matcher: FMT6QLJK76**

4. **Sjekk at nøkkelen IKKE er revoked eller expired**

---

## Alternativ test: Generer NY APNs key

Hvis eksisterende nøkkel ikke har APNs enabled:

1. Gå til: https://developer.apple.com/account/resources/authkeys/add
2. Name: "FCM Push Notifications"
3. ✅ Enable: "Apple Push Notifications service (APNs)"
4. Continue → Register → Download .p8 file
5. Noter Key ID (f.eks. ABCD1234EF)

6. Last opp til Firebase Console for BEGGE apps:
   - BadmintonPlayer: Development OG Production
   - BadmintonWalletManager: Development OG Production

7. Slett BadmintonPlayer app fra iPhone
8. Slett FCM token fra Firestore
9. Reinstall fra Xcode
10. Test igjen

---

## Hvis nøkkelen HAR APNs enabled men fortsatt feiler:

Da er problemet sannsynligvis at FCM/Firebase har et routing-problem mellom Development/Production environments.

Mulig løsning: **TestFlight build med Production signing**

Dette vil tvinge alt til Production environment:
1. Archive app i Xcode
2. Export for App Store distribution
3. Upload til TestFlight
4. Install fra TestFlight
5. Test push notifications

Med TestFlight får du:
- Production APNs token
- Production signing
- Production FCM routing

Dette eliminerer alle development/production mismatch muligheter.
