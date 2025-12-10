# Line Notification Setup Guide

## Hva vi har gjort så langt:

✅ Opprettet Line Messaging API channel
✅ Lagt bot til badminton-gruppen
✅ Fått Channel Access Token
✅ Laget Firebase Cloud Function
✅ Oppdatert app.js til å sende varsler

## Neste steg:

### 1. Få Line Group ID

For å sende meldinger til gruppen, trenger vi **Group ID**. Her er hvordan:

#### Alternativ A: Bruk utvikler-verktøyet (Enklest)

1. **Gå til Line Developers Console** → Din "Badminton" kanal → **Messaging API** tab
2. Finn **"Webhook URL"** seksjonen
3. Klikk **"Edit"** og sett Webhook URL til: `https://webhook.site/` (dette er en test-tjeneste)
4. Hent din unike webhook URL fra https://webhook.site/
5. Lim inn URL-en i "Webhook URL" feltet i Line Console
6. **Aktiver "Use webhook"** (sett til ON)
7. **Klikk "Verify"** for å teste
8. **Send en melding i badminton-gruppen** (f.eks. "test")
9. **Gå tilbake til webhook.site** - du vil se webhook-data
10. **Finn "groupId"** i JSON-dataen (starter med "C")
11. **Kopier Group ID** og lagre det trygt!

#### Alternativ B: Bruk test-script (Krever litt koding)

Se `get-group-id.html` filen vi lager i neste steg.

### 2. Konfigurer Firebase Environment Variables

Du har:
- **Channel Access Token:** `nimq0V/9prYwgpytbFEHvNuPAz8mMXcHeycclYdVClu4fWQzTgMAwrbDiMui3ekR7ygI+DdiCXYFGW1LtwgbdrpfUhUNLE4/Gk9s/9+q+XBeBqBTNhQjUXWlSf1r/wl+3PN6F0ukDkIzupsSywG0kAdB04t89/1O/w1cDnyilFU=`
- **Group ID:** (du får dette i steg 1)

Kjør disse kommandoene i terminal:

```bash
# Gå til prosjekt-mappen
cd /Users/geirlapstuen/Swift/lineapp

# Sett Line Access Token
npx firebase functions:config:set line.token="DIN_LINE_ACCESS_TOKEN_HER"

# Sett Line Group ID
npx firebase functions:config:set line.groupid="DIN_GROUP_ID_HER"

# Sjekk at det er satt riktig
npx firebase functions:config:get
```

**VIKTIG:** Erstatt `DIN_LINE_ACCESS_TOKEN_HER` med den faktiske token-en, og `DIN_GROUP_ID_HER` med Group ID-en du fant.

### 3. Logg inn på Firebase CLI

```bash
npx firebase login
```

Dette åpner nettleser - logg inn med Google-kontoen som har tilgang til Firebase-prosjektet.

### 4. Deploy Firebase Functions

```bash
# Deploy kun Functions
npx firebase deploy --only functions

# ELLER deploy alt (Functions + Hosting)
npx firebase deploy
```

### 5. Test Line-varsling

1. Åpne appen i nettleseren
2. Logg inn som en bruker
3. Meld deg på badminton
4. **Meld deg AV**
5. **Sjekk badminton Line-gruppen** - du skal få en melding! 🎉

## Eksempel på Line-melding:

```
🏸 LEDIG PLASS! / SLOT AVAILABLE!

⚠️ John meldte seg av
John cancelled registration

👥 Nå 11/12 spillere
Now 11/12 players

📅 Monday / วันจันทร์
🕐 18:00 - 20:00
📆 04/01/2025

👉 Meld deg på her / Sign up here:
https://badminton-b95ac.web.app
```

## Feilsøking

### "Line Access Token not configured"
- Kjør: `npx firebase functions:config:set line.token="TOKEN_HER"`
- Deploy på nytt

### "Line Group ID not configured"
- Kjør: `npx firebase functions:config:set line.groupid="GROUP_ID_HER"`
- Deploy på nytt

### Ingen melding i Line
- Sjekk Firebase Functions logs: `npx firebase functions:log`
- Verifiser at bot-en er i gruppen
- Sjekk at "Allow bot to join group chats" er Enabled

### "Permission denied" ved deploy
- Logg inn på nytt: `npx firebase login`
- Sjekk at du har riktig Firebase-prosjekt: `npx firebase projects:list`

## Nyttige kommandoer

```bash
# Se Functions logs
npx firebase functions:log

# Test Functions lokalt (emulator)
npx firebase emulators:start --only functions

# Se konfigurasjon
npx firebase functions:config:get

# Liste alle prosjekter
npx firebase projects:list

# Bytte prosjekt
npx firebase use PROJECT_ID
```

## Kostnader

Med Blaze-planen og ditt brukstilfelle (24-48 varsler/måned):
- **Gratis tier:** 125,000 invocations/month
- **Ditt forbruk:** ~24-48 invocations/month
- **Kostnad:** 0 NOK (helt gratis) ✅

## Neste funksjon: Registrerings-varsler?

Hvis du vil, kan vi også legge til varsler når:
- Noen melder seg PÅ (hvis det er få plasser igjen)
- Noen markerer betaling
- Ny økt startes

Bare si fra! 🚀
