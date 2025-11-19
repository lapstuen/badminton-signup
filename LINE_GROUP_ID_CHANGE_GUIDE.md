# Guide: Bytte Line Group ID (fra produksjon til test, eller omvendt)

**Opprettet:** 2025-11-19
**Scenario:** Vi prøvde å bytte fra produksjonsgruppe til testgruppe og det tok 3+ timer. Dette skal ALDRI skje igjen.

---

## TL;DR - Quick Steps

```bash
# 1. Slett .env fil (VIKTIG!)
rm functions/.env

# 2. Slett gamle config parameters
firebase functions:config:unset line

# 3. Sett ny Group ID som SECRET
echo "NY_GROUP_ID_HER" | firebase functions:secrets:set LINE_GROUP_ID

# 4. Deploy alle funksjoner
firebase deploy --only functions
```

---

## Problemet vi hadde

### Symptomer
- ✅ Firebase secret var satt til testgruppe: `C8a76ca2d826827e9fe5d13f7d7e31e3a`
- ❌ Funksjoner sendte fortsatt til produksjon: `Cf7ec53bd83599cc8a05b3b1552039023`
- ❌ Deploy feilet med: "Secret environment variable overlaps non secret environment variable"

### Root Cause
Line credentials ble lagret på **3 steder samtidig**, og de konkurrerte:

1. **Firebase Secrets** (Secrets Manager) - NY metode ✅
2. **Firebase Config** (functions:config) - GAMMEL metode ❌
3. **`.env` fil** (environment variables) - LOKAL fil ❌

Firebase tillater IKKE samme variabel både som secret OG som environment variable.

---

## Detaljert Forklaring

### Hvordan Line credentials SKAL fungere (korrekt oppsett)

```javascript
// functions/index.js - RIKTIG MÅTE
const {defineSecret} = require('firebase-functions/params');  // ← defineSecret, IKKE defineString

const lineToken = defineSecret('LINE_TOKEN');
const lineGroupId = defineSecret('LINE_GROUP_ID');

exports.sendSessionAnnouncement = onCall({
    secrets: [lineToken, lineGroupId]  // ← MÅ eksplisitt liste secrets!
}, async (request) => {
    const accessToken = lineToken.value();  // Les fra secret
    const groupId = lineGroupId.value();     // Les fra secret
    // ... kode
});
```

**Kritiske punkter:**
1. Bruk `defineSecret`, IKKE `defineString`
2. Legg til `secrets: [lineToken, lineGroupId]` i `onCall({...})`
3. INGEN `.env` fil
4. INGEN `functions:config:set` verdier

---

## Hva gikk galt - Steg for steg

### 1. Opprinnelig oppsett (fungerte, men feil metode)
```javascript
const {defineString} = require('firebase-functions/params');  // ← Feil!
const lineToken = defineString('LINE_TOKEN');
const lineGroupId = defineString('LINE_GROUP_ID');
```

Verdier lagret i:
- `functions/.env` fil
- `firebase functions:config:set line.token=...`
- `firebase functions:config:set line.groupid=...`

**Dette fungerte, men brukte GAMMEL deprecated API.**

### 2. Første forsøk: Sette secrets
```bash
firebase functions:secrets:set LINE_GROUP_ID
# Input: C8a76ca2d826827e9fe5d13f7d7e31e3a (testgruppe)
```

**Problem:** Koden brukte fortsatt `defineString` som leser PARAMETERS, ikke SECRETS.
**Resultat:** Funksjoner fortsatte å bruke gammel verdi fra `.env`/config.

### 3. Andre forsøk: Endre til defineSecret
```javascript
const {defineSecret} = require('firebase-functions/params');  // Endret
const lineToken = defineSecret('LINE_TOKEN');
const lineGroupId = defineSecret('LINE_GROUP_ID');
```

**Problem:** Ingen `secrets: [...]` i `onCall()` options.
**Resultat:** Funksjoner hadde ikke tilgang til secrets, brukte fortsatt gammel verdi.

### 4. Tredje forsøk: Legge til secrets i options
```javascript
exports.sendSessionAnnouncement = onCall({
    secrets: [lineToken, lineGroupId]  // Lagt til
}, async (request) => { ... });
```

**Problem:** Deploy feilet med "Secret environment variable overlaps non secret environment variable"
**Årsak:** `.env` fil og `functions:config` hadde fortsatt LINE_TOKEN og LINE_GROUP_ID.
**Resultat:** Firebase nektet å deploye fordi samme variabel var både secret OG env var.

### 5. Fjerde forsøk: Slette gamle config
```bash
firebase functions:config:unset line
```

**Problem:** Deploy feilet fortsatt.
**Årsak:** `.env` filen eksisterte fortsatt!
**Resultat:** Samme feil.

### 6. Femte forsøk: Slette funksjoner og deploye på nytt
```bash
firebase functions:delete sendSessionAnnouncement sendCancellationNotification ...
firebase deploy --only functions
```

**Problem:** Deploy feilet fortsatt.
**Årsak:** `.env` filen lastes inn av Firebase CLI ved deploy!

### 7. LØSNING: Slette .env fil
```bash
rm functions/.env
firebase deploy --only functions
```

**✅ FUNGERTE!**

---

## Komplette steg for å bytte Group ID

### Scenario A: Fra produksjon til test

```bash
# 1. Bekreft hvor du sender nå
firebase functions:secrets:access LINE_GROUP_ID
# Output: Cf7ec53bd83599cc8a05b3b1552039023 (produksjon)

# 2. Slett .env fil (kritisk!)
rm functions/.env

# 3. Slett gamle config (hvis de eksisterer)
firebase functions:config:unset line

# 4. Sett ny Group ID
echo "C8a76ca2d826827e9fe5d13f7d7e31e3a" | firebase functions:secrets:set LINE_GROUP_ID

# 5. Verifiser
firebase functions:secrets:access LINE_GROUP_ID
# Output: C8a76ca2d826827e9fe5d13f7d7e31e3a

# 6. Deploy
firebase deploy --only functions

# 7. Test i appen
# Klikk "🧪 Test Line Config" og sjekk logs:
firebase functions:log | grep "Group ID"
# Skal vise: Group ID: C8a76ca2d826827e9fe5d13f7d7e31e3a
```

### Scenario B: Fra test tilbake til produksjon

```bash
# Samme steg, men bruk produksjons-Group ID
echo "Cf7ec53bd83599cc8a05b3b1552039023" | firebase functions:secrets:set LINE_GROUP_ID
firebase deploy --only functions

# OG: Legg boten tilbake i produksjonsgruppen på Line!
```

---

## Viktige Line Group IDs

| Gruppe | Medlemmer | Group ID | Bruk |
|--------|-----------|----------|------|
| **Badminton (Produksjon)** | 40 | `Cf7ec53bd83599cc8a05b3b1552039023` | Live notifications |
| **Badminton Line Test** | 3 (Geir, wife, bot) | `C8a76ca2d826827e9fe5d13f7d7e31e3a` | Testing |

---

## Hvordan få Group ID fra en ny gruppe

### Metode 1: Via webhook (anbefalt)

1. **Sett opp webhook i Line Developers Console**
   - Webhook URL: `https://us-central1-badminton-b95ac.cloudfunctions.net/lineWebhook`
   - Enable webhook
   - Verify SSL

2. **Legg boten til gruppen**

3. **Send en melding i gruppen**

4. **Sjekk logs**
```bash
firebase functions:log --only lineWebhook
# Se etter: "🔍 GROUP ID FOUND: C..."
```

### Metode 2: Via Line API (manuelt)

Se Line Messaging API dokumentasjon for `Get group summary` endpoint.

---

## Feilsøking

### "Secret environment variable overlaps non secret environment variable"

**Løsning:**
```bash
rm functions/.env
firebase functions:config:unset line
firebase deploy --only functions
```

### Funksjoner bruker fortsatt gammel Group ID

**Sjekk:**
1. Er `.env` fil slettet?
2. Er `functions:config` slettet?
3. Bruker koden `defineSecret` (ikke `defineString`)?
4. Har funksjoner `secrets: [...]` i options?

**Verifiser:**
```bash
# Sjekk secret
firebase functions:secrets:access LINE_GROUP_ID

# Test og sjekk logs
firebase functions:log | grep "Group ID"
```

### Line API returnerer 400 "Failed to send messages"

**Årsaker:**
1. ✅ Boten er IKKE i gruppen (forventet ved testing)
2. ❌ Ugyldig Group ID
3. ❌ Ugyldig Access Token

**Løsning:** Legg boten til gruppen på Line.

---

## Kode-endringer som ble gjort

### functions/index.js - Før og etter

**FEIL (opprinnelig):**
```javascript
const {defineString} = require('firebase-functions/params');  // ❌
const lineToken = defineString('LINE_TOKEN');
const lineGroupId = defineString('LINE_GROUP_ID');

exports.sendSessionAnnouncement = onCall(async (request) => {  // ❌ Mangler secrets
    const accessToken = lineToken.value();
    const groupId = lineGroupId.value();
    // ...
});
```

**RIKTIG (nå):**
```javascript
const {defineSecret} = require('firebase-functions/params');  // ✅
const lineToken = defineSecret('LINE_TOKEN');
const lineGroupId = defineSecret('LINE_GROUP_ID');

exports.sendSessionAnnouncement = onCall({
    secrets: [lineToken, lineGroupId]  // ✅ Eksplisitt secrets
}, async (request) => {
    const accessToken = lineToken.value();
    const groupId = lineGroupId.value();
    // ...
});
```

**Endret i ALLE funksjoner:**
- `sendSessionAnnouncement`
- `sendCancellationNotification`
- `sendNudgeNotification`
- `sendLineMessage`
- `sendPasswordResetNotification`
- `testLineConfig`

### Slettede filer
- `functions/.env` - Slettet permanent
- `firebase functions:config` `line.token` og `line.groupid` - Slettet

---

## Testing checklist

Før du går fra test til produksjon:

- [ ] Verifiser secret: `firebase functions:secrets:access LINE_GROUP_ID`
- [ ] Deploy: `firebase deploy --only functions`
- [ ] Test i appen: "🧪 Test Line Config"
- [ ] Sjekk logs: `firebase functions:log | grep "Group ID"`
- [ ] Bekreft riktig gruppe mottar melding
- [ ] **Legg boten til produksjonsgruppen (hvis fjernet)**
- [ ] Send real notification og verifiser

---

## Hva lærte vi

### Hva gikk galt
1. **Blanding av secrets og env vars** - Firebase tillater ikke begge samtidig
2. **defineString vs defineSecret** - Feil funksjon leser feil storage
3. **Manglende `secrets: [...]`** - Funksjoner trenger eksplisitt tilgang
4. **`.env` fil** - Lastes automatisk og overstyrer alt annet
5. **Gamle config** - `functions:config` er deprecated men fortsatt aktiv

### Hva fungerer nå
1. ✅ Bruker Firebase Secrets Manager (moderne, sikker)
2. ✅ `defineSecret` leser fra riktig sted
3. ✅ Eksplisitt `secrets: [...]` i alle funksjoner
4. ✅ Ingen `.env` fil
5. ✅ Ingen `functions:config` verdier
6. ✅ Enkel bytte av Group ID med én kommando

### Nøkkel-innsikt
**Firebase Functions v2 med secrets krever:**
- `defineSecret` (ikke `defineString`)
- `secrets: [...]` i function options
- **INGEN** `.env` fil
- **INGEN** `functions:config` verdier med samme navn

**Hvis noe ikke fungerer, start med å slette `.env` og `functions:config`!**

---

## Fremtidige forbedringer

1. **Automatisk testing**: Script som deployer og verifiserer Group ID
2. **Environment-basert**: Separate Firebase projects for test/prod
3. **CI/CD**: Automated deployment med riktig secrets per miljø

---

**Sist oppdatert:** 2025-11-19
**Status:** ✅ Fungerer med testgruppe `C8a76ca2d826827e9fe5d13f7d7e31e3a`
