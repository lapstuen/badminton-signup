# Line Notification - Simple API Guide

**Versjon:** 2025-11-19
**Status:** ✅ Klar til bruk

---

## TL;DR - Sende en melding (super enkelt!)

```javascript
// Det er ALT du trenger!
await sendLineNotification('Din melding her!');
```

---

## Hva er dette?

Et enkelt rammeverk for å sende Line-meldinger fra hvor som helst i appen.

**Du trenger IKKE:**
- ❌ Å forstå Firebase Cloud Functions
- ❌ Å bekymre deg for Group ID
- ❌ Å håndtere errors manuelt
- ❌ Å skrive kompleks kode

**Du trenger BARE:**
- ✅ Kalle `sendLineNotification(message)`
- ✅ Skrive meldingen din
- ✅ Det er det!

---

## Grunnleggende bruk

### 1. Enkel melding

```javascript
await sendLineNotification('Hello from Badminton app!');
```

### 2. Flerlinjet melding

```javascript
await sendLineNotification(`
    🏸 SESSION REMINDER / เตือนความจำ

    Don't forget tonight's session!
    อย่าลืมเซสชันคืนนี้!

    📅 ${state.sessionDay}
    🕐 ${state.sessionTime}
`);
```

### 3. Med session-info

```javascript
await sendLineNotification(`
    ✅ REGISTRATION OPEN / เปิดลงทะเบียน

    📅 ${state.sessionDay}
    🕐 ${state.sessionTime}
    💰 ${state.paymentAmount} THB
    👥 ${state.players.length}/${state.maxPlayers} players

    👉 ${APP_URL}
`);
```

### 4. Med error-håndtering

```javascript
const success = await sendLineNotification('My message');
if (success) {
    console.log('Melding sendt!');
} else {
    console.log('Feil ved sending');
}
```

---

## Eksempler fra appen

### Eksempel 1: Session lukket

Legg til i `clearSession()` funksjonen:

```javascript
async function clearSession() {
    // ... existing code ...

    // Send notification når session lukkes
    await sendLineNotification(`
        🔴 SESSION CLOSED / เซสชันปิด

        📅 ${state.sessionDay}

        Thank you everyone for playing!
        ขอบคุณทุกคนที่มาเล่น!
    `);

    // ... rest of code ...
}
```

### Eksempel 2: Session åpnet

Legg til i `publishSession()` funksjonen:

```javascript
async function publishSession() {
    // ... existing code ...

    // Send notification når session publiseres
    await sendLineNotification(`
        🎉 SESSION PUBLISHED / เผยแพร่เซสชันแล้ว!

        📅 ${state.sessionDay}
        🕐 ${state.sessionTime}
        💰 ${state.paymentAmount} THB

        Registration is now open!
        ลงทะเบียนเปิดแล้ว!

        👉 ${APP_URL}
    `);

    // ... rest of code ...
}
```

### Eksempel 3: Custom knapp

Legg til i HTML:

```html
<button onclick="sendReminderMessage()">Send Reminder</button>
```

Legg til i app.js:

```javascript
async function sendReminderMessage() {
    await sendLineNotification(`
        ⏰ REMINDER / เตือนความจำ

        Session tomorrow!
        เซสชันพรุ่งนี้!

        📅 ${state.sessionDay}
        🕐 ${state.sessionTime}

        See you there!
        พบกันที่นั่น!
    `);
}
```

### Eksempel 4: Full/Empty spots

Legg til logikk i `handleSignup()`:

```javascript
async function handleSignup() {
    // ... existing code ...

    // Sjekk om session er nå full
    if (state.players.length === state.maxPlayers) {
        await sendLineNotification(`
            ⚠️ SESSION FULL / เซสชันเต็ม!

            📅 ${state.sessionDay}
            👥 ${state.maxPlayers}/${state.maxPlayers}

            All spots taken!
            ที่นั่งเต็มแล้ว!
        `);
    }
}
```

---

## Testing

### Test Demo Line button

1. Åpne appen
2. Logg inn som admin
3. Klikk på ⚙️ Settings
4. Klikk på "📤 Test Demo Line"
5. Sjekk Line-gruppen

### Customizing demo message

Finn `testDemoLine()` i `app.js` (linje ~856):

```javascript
async function testDemoLine() {
    const message = `
        🎯 DEMO MESSAGE / ข้อความทดสอบ

        Your custom text here!
        ข้อความของคุณที่นี่!
    `;

    await sendLineNotification(message);
}
```

---

## Hvor er koden?

### Frontend (app.js)

**Hovedfunksjon:** `sendLineNotification(message)` - linje ~826

```javascript
async function sendLineNotification(message) {
    const sendMessage = functions.httpsCallable('sendLineMessage');
    const result = await sendMessage({ message });
    return true;
}
```

**Demo-funksjon:** `testDemoLine()` - linje ~856

**Eksempler:** Kommentarer i app.js - linje ~900-968

### Backend (functions/index.js)

**Cloud Function:** `sendLineMessage` - linje 433

```javascript
exports.sendLineMessage = onCall({
    secrets: [lineToken, lineGroupId]
}, async (request) => {
    const { message } = request.data;
    // Send to Line API...
});
```

---

## Viktig!

### Group ID

Line-meldinger sendes til gruppen definert i:
- **Firebase Secret:** `LINE_GROUP_ID`
- **Nåværende:** `C8a76ca2d826827e9fe5d13f7d7e31e3a` (testgruppe - 3 medlemmer)
- **Produksjon:** `Cf7ec53bd83599cc8a05b3b1552039023` (40 medlemmer)

For å bytte gruppe, se `LINE_GROUP_ID_CHANGE_GUIDE.md`.

### Kostnader

Firebase Cloud Functions:
- ✅ Gratis for < 2M requests/måned
- ✅ ~120 meldinger/måned = godt innenfor

Line Messaging API:
- ✅ Gratis: 500 meldinger/måned
- ✅ Betalt: 15,000 meldinger/måned

---

## Feilsøking

### "Failed to send Line notification"

**Sjekk:**
1. Er Firebase secrets satt?
   ```bash
   firebase functions:secrets:access LINE_GROUP_ID
   firebase functions:secrets:access LINE_TOKEN
   ```

2. Er funksjonen deployet?
   ```bash
   firebase deploy --only functions:sendLineMessage
   ```

3. Er boten i gruppen?
   - Sjekk Line-gruppen
   - Legg til Badminton-boten hvis den mangler

### "Line API error: Failed to send messages"

**Årsak:** Boten er ikke i gruppen

**Løsning:** Legg boten til gruppen på Line

### Melding sendes ikke

**Sjekk logs:**
```bash
firebase functions:log --only sendLineMessage
```

**Se etter:**
- ✅ "📤 Sending generic message to Line"
- ✅ "✅ Message sent successfully"
- ❌ "❌ Error sending Line message"

---

## Tips & Tricks

### 1. Korte meldinger

```javascript
await sendLineNotification('Quick update! / อัพเดตด่วน!');
```

### 2. Emoji for oppmerksomhet

```javascript
🎉 🏸 ⏰ ⚠️ ✅ ❌ 🔴 🟢 📅 🕐 💰 👥 👉
```

### 3. Bilingual messages

Alltid inkluder både engelsk og thai:
```javascript
await sendLineNotification(`
    ✅ SUCCESS / สำเร็จ

    Your action completed!
    การดำเนินการเสร็จสมบูรณ์!
`);
```

### 4. Bruk template literals

```javascript
const spots = state.maxPlayers - state.players.length;
await sendLineNotification(`
    ${spots} spots available!
    มี ${spots} ที่ว่าง!
`);
```

### 5. Test først!

Alltid test i testgruppen før produksjon:
- Current: Testgruppe (3 medlemmer)
- Når klar: Bytt til produksjon

---

## Neste steg

### Legge til egne meldinger

1. Finn stedet i koden hvor du vil sende melding
2. Skriv meldingen din
3. Kall `await sendLineNotification(message)`
4. Test!

### Eksempel - Ny funksjon

```javascript
async function sendWeatherUpdate() {
    await sendLineNotification(`
        ☀️ WEATHER UPDATE / อัพเดตสภาพอากาศ

        Today: Sunny, 28°C
        วันนี้: แดดดี 28°C

        Perfect for badminton!
        เหมาะสำหรับเล่นแบดมินตัน!
    `);
}
```

### Eksempel - Scheduled message

Bruk Firebase Scheduled Functions for automatiske meldinger:

```javascript
// functions/index.js
exports.dailyReminder = onSchedule('0 18 * * *', async (event) => {
    // Kjører hver dag kl 18:00
    await sendTomorrowReminder();
});
```

---

## Support

**Problemer?**
1. Sjekk `LINE_GROUP_ID_CHANGE_GUIDE.md`
2. Sjekk Firebase logs: `firebase functions:log`
3. Test med "Test Demo Line" knappen

**Fungerer?**
- ✅ Du ser melding i Line-gruppen
- ✅ Logs viser "Message sent successfully"

---

**Sist oppdatert:** 2025-11-19
**Status:** ✅ Klar til bruk
**Test-gruppe:** C8a76ca2d826827e9fe5d13f7d7e31e3a (3 medlemmer)

