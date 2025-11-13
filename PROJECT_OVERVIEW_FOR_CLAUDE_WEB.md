# lineApp & BadmintonWalletManager - Project Overview

## 1. HOVEDPRODUKT: lineApp (Web Application)

### Hva er lineApp?
**lineApp** er et komplett web-basert badminton påmeldingssystem med real-time Firebase backend og LINE Messaging API integrasjon. Appen lar spillere melde seg på badminton-økter, håndtere betalinger via wallet-system, og motta automatiske varsler når plasser blir ledige.

**Live URL:** https://lapstuen.github.io/badminton-signup/
**GitHub:** https://github.com/lapstuen/badminton-signup
**Teknologi:** Vanilla JavaScript, Firebase (Firestore, Functions, Hosting), LINE Messaging API

---

## 2. TEKNOLOGI STACK (lineApp)

### Frontend
- **Vanilla JavaScript (ES6+)** - Ingen frameworks, direkte Firebase integration
- **HTML5 + CSS3** - Responsivt design, PWA-kompatibelt
- **Progressive Web App (PWA)** - Installerbar på mobil/desktop

### Backend
- **Firebase Firestore** - NoSQL real-time database med automatisk synkronisering
- **Firebase Cloud Functions** - Serverless Node.js funksjoner for LINE varsler
- **Firebase Hosting** - Static file CDN med global edge network

### Eksterne integrasjoner
- **LINE Messaging API** - Automatiske varsler til LINE gruppe ved avmeldinger og publisering

### Språkstøtte
- **Trilingual UI** - Norsk, Engelsk, Thai (inline translations)

---

## 3. HOVEDFUNKSJONER (lineApp)

### 3.1 Wallet-system (Betalingssystem)
Hver autorisert bruker har en digital wallet med saldo i THB:

**Automatiske transaksjoner:**
- Påmelding → Trekker beløp fra wallet (default 150 THB)
- Avmelding → Refunderer beløp tilbake til wallet
- Admin kan toppe opp saldo via "Manage Wallets"
- Full transaksjonshistorikk med timestamp

**Wallet-logikk:**
```javascript
// Ved påmelding
currentBalance = 500 THB
paymentAmount = 150 THB
newBalance = 350 THB // Automatisk trekk

// Ved avmelding
newBalance = 500 THB // Automatisk refundering
```

**Insufficient balance protection:**
- Brukere kan ikke melde seg på hvis saldo < paymentAmount
- System viser feilmelding: "Insufficient balance / ยอดเงินไม่เพียงพอ"

### 3.2 Draft/Publish System
Nye økter starter i draft-modus (upublished):

**Draft mode:**
- Admin kan sette opp økt uten at brukere kan melde seg på
- Legge til regular players
- Justere detaljer (tid, dato, max spillere)

**Publish:**
- Gjør økten synlig for alle brukere
- Trekker automatisk fra wallet for spillere som ikke har markert betaling
- Sender LINE-varsel til gruppe

### 3.3 Regular Players Management
Admin kan administrere faste spillere per ukedag (1-7):

**Features:**
- Clickable UI for enkel valg av regular players
- Auto-load av regular players når admin åpner "Manage Today's Players"
- Mulighet til å legge til spiller kun for DENNE økten eller alle økter (make regular)

### 3.4 Real-time Synchronization
**Firebase onSnapshot() listeners:**
- Multi-device sync i real-time
- Bruker A melder seg på → Bruker B ser oppdatering instantly
- Admin endrer max players → Alle brukere ser ny limit umiddelbart
- Betaling markeres → Status oppdateres for alle

### 3.5 LINE Messaging Integration
**Automatiske varsler til LINE gruppe:**

**Ved avmelding:**
- Sender melding om hvem som meldte seg av
- Viser antall ledige plasser hvis INGEN venteliste
- Hvis venteliste finnes: sender kun enkel avmeldingsnotis (unngå spam)

**Ved publisering:**
- Admin kan dele økt-annonsering til LINE gruppe
- Inneholder øktdetaljer, ledige plasser, venteliste-info
- Direktelink til påmeldingsside

**Implementasjon:**
```javascript
// Frontend (app.js)
async function cancelRegistration() {
    await playersRef().doc(playerId).delete();
    sendLineCancellationNotification(userName); // Async non-blocking
}

// Backend (functions/index.js)
exports.sendCancellationNotification = onCall(async (request) => {
    const message = buildMessage(request.data);
    await axios.post('https://api.line.me/v2/bot/message/push', {
        to: groupId,
        messages: [{type: 'text', text: message}]
    });
});
```

### 3.6 Session Management
**Automatisk daglig session:**
- Session ID = ISO date format: `YYYY-MM-DD` (e.g., "2025-01-04")
- Hver dag får automatisk ny session
- Admin kan starte ny session (clear previous)

**Session detaljer:**
- Dato (DD/MM/YYYY)
- Ukedag (bilingual: "Monday / วันจันทร์")
- Tid (e.g., "18:00 - 20:00")
- Max spillere (default: 12)
- Betalingsbeløp (default: 150 THB)

### 3.7 Player Registration
**Brukerflyt:**
1. Login med autorisert bruker (navn + passord)
2. Se ledige plasser
3. Meld deg på med ett klikk
4. System trekker automatisk fra wallet
5. Kan markere betaling selv
6. Kan avmelde og få refund

**Features:**
- Duplicate name prevention (kan ikke melde seg på to ganger)
- Waiting list når full (spillere 13+)
- Automatic position assignment (1-indexed)
- Payment tracking (paid/unpaid)

### 3.8 Admin Panel
**Passordbeskyttet admin panel** (passord: `admin123`):

**Admin-funksjoner:**
- **Start New Session** - Clear alle spillere, reset for ny økt
- **Change Session Details** - Endre dag, tid, legge til regular players
- **Manage Regular Players** - Clickable UI for valg av faste spillere per ukedag
- **Manage Today's Players** - Legge til/fjerne spillere for dagens økt
- **Publish Session** - Publiser draft og trekk fra wallet
- **Share to LINE** - Del økt-annonsering til LINE gruppe
- **Change Payment Amount** - Oppdater økt-pris
- **Change Max Players** - Juster kapasitet
- **Manage Authorized Users** - Legge til/fjerne/redigere brukere
- **Manage Wallets** - Topp opp/juster bruker wallet-saldo
- **View Transactions** - Se transaksjonshistorikk
- **Refund Waiting List** - Refunder alle venteliste-spillere
- **Export List** - Last ned spillerliste som `.txt`

### 3.9 localStorage & Multi-Device Support
**Auto-login per device:**
- localStorage lagres **lokalt på hver enhet** (Mac Safari, iPhone Safari, iPad Safari)
- Brukere må logge inn **en gang per enhet**
- Auto-login fungerer på den enheten til:
  - Passord blir reset av admin
  - Browser data/localStorage cleares
  - Bruker logger eksplisitt ut

**Password typer:**
- **Auto-generated (UUID)** - Lange random strings, genereres når admin lager ny bruker uten passord
- **Custom passwords** - Admin kan sette faste passord (e.g., "geir2025", "12345678")
  - Anbefalt for brukere med flere enheter
  - Samme passord fungerer på alle enheter

---

## 4. FIRESTORE DATABASE STRUCTURE (lineApp)

```
/sessions/{sessionId}  // sessionId = "YYYY-MM-DD" (ISO date)
├─ date: string (DD/MM/YYYY)
├─ day: string (e.g., "Wednesday / วันพุธ")
├─ time: string (e.g., "10:00 - 12:00")
├─ maxPlayers: number (default: 12)
├─ paymentAmount: number (default: 150 THB)
├─ published: boolean (draft/published state)
├─ createdAt: timestamp
└─ /players/{playerId}
    ├─ name: string
    ├─ paid: boolean
    ├─ timestamp: timestamp
    ├─ position: number (1-indexed)
    ├─ clickedPaymentLink: boolean (optional)
    ├─ isRegular: boolean (optional)
    ├─ markedPaidAt: timestamp (optional)
    └─ deductedFromWallet: boolean (optional)

/authorizedUsers/{userId}
├─ name: string
├─ password: string (plain text - security issue!)
├─ balance: number (wallet saldo i THB)
├─ role: string (optional: "moderator", "admin")
├─ regularDays: [int] (array av ukedager 1-7)
├─ createdAt: timestamp

/transactions/{transactionId}
├─ userId: string
├─ userName: string
├─ amount: number (positive = top-up, negative = deduction)
├─ description: string (e.g., "Registered for session", "Cancelled session")
├─ timestamp: timestamp
```

---

## 5. BadmintonWalletManager (iOS/Mac SwiftUI App)

### Hva er BadmintonWalletManager?
**BadmintonWalletManager** er en **SwiftUI-basert iOS/Mac Catalyst app** som gir en delmengde av lineApp-funksjonaliteten i en native mobile/desktop app.

**Repository:** `/Users/geirlapstuen/Swift/BadmintonWalletManager`
**Teknologi:** Swift, SwiftUI, Firebase SDK for iOS

### Funksjoner (subset av lineApp)
BadmintonWalletManager fokuserer på **admin wallet management** og transaksjonshistorikk:

**Features:**
1. **User List med Wallet Balances**
   - Viser alle autoriserte brukere med saldo
   - Farge-kodet saldo: Rød (<150 THB), Orange (150-450 THB), Grønn (>450 THB)
   - Søkefunksjon
   - Total balance overview

2. **User Detail View**
   - Vis brukerdetaljer (navn, saldo, role, regular days)
   - Topp opp wallet via quick buttons (100, 150, 300 THB)
   - Custom amount input
   - Transaction history for bruker
   - Dedukter beløp (negative transaksjoner)

3. **Transaction Management**
   - Vis alle transaksjoner på tvers av alle brukere
   - Filtrer etter type: All, Top-ups, Deductions
   - Persistent filter state (UserDefaults)
   - Sortert etter nyeste først
   - Viser bruker, beløp, beskrivelse, timestamp

4. **Backup/Admin View**
   - Firebase data backup utilities
   - Admin tools (kommende funksjoner)

5. **Web App Integration**
   - Globe-knapp åpner lineApp i browser
   - Direkte link til: `https://lapstuen.github.io/badminton-signup/index.html`

### SwiftUI Implementasjon
**Arkitektur:**
```swift
// Main App Entry
@main
struct BadmintonWalletManagerApp: App {
    init() {
        setupFirebase()
    }
}

// Firebase Manager (@StateObject)
class FirebaseManager: ObservableObject {
    @Published var users: [User] = []
    @Published var transactions: [Transaction] = []

    func listenToUsers() { /* Firestore snapshot listener */ }
    func topUpUser(userId, amount) { /* Update balance + create transaction */ }
}

// Models
struct User: Identifiable, Codable {
    let id: String
    var name: String
    var balance: Double
    var password: String
    var role: String?
    var regularDays: [Int]?
}

struct Transaction: Identifiable, Codable {
    let id: String
    let userId: String
    let userName: String
    let amount: Double
    let description: String
    let timestamp: Date
}
```

**Views:**
- `ContentView.swift` - Hovedliste med brukere og summary
- `UserDetailView.swift` - Brukerdetaljer, top-up, transaksjonshistorikk
- `TransactionManagerView.swift` - Alle transaksjoner med filtering
- `AllTransactionsView.swift` - Transaksjons-sheet view
- `BackupView.swift` - Backup/admin utilities
- `NewUserView.swift` - Opprett ny bruker

### Sammenheng med lineApp
**BadmintonWalletManager** er **IKKE** en full kopi av lineApp, men en **admin-fokusert companion app**:

| Feature | lineApp (Web) | BadmintonWalletManager (iOS/Mac) |
|---------|---------------|----------------------------------|
| Bruker wallet management | ✅ Admin panel | ✅ **Primært fokus** |
| Transaction history | ✅ Admin panel | ✅ **Enhanced view** |
| Session registration | ✅ | ❌ (bruk web-appen) |
| Admin panel | ✅ Full featured | ❌ (kun wallet) |
| LINE notifications | ✅ | ❌ |
| Draft/Publish | ✅ | ❌ |
| Regular players | ✅ | ❌ (shows regularDays) |

**Hvorfor to apper?**
- **lineApp (Web)** - Full-featured, tilgjengelig for alle (spillere + admin)
- **BadmintonWalletManager (iOS/Mac)** - Native app for rask wallet-administrasjon for admin on-the-go
- Admin kan raskt toppe opp wallets fra iPhone/iPad uten å åpne webappen

---

## 6. SIKKERHET (VIKTIG!)

### Kjente sikkerhetsproblemer (lineApp)

⚠️ **HIGH PRIORITY:**
1. **Plain text passwords** - Passord lagres i klartekst i Firestore
   - **Risk:** Brukerkredentialer i risiko
   - **Fix:** Implementer bcrypt/scrypt hashing

2. **Hardcoded admin password** - `admin123` i kode (app.js:556)
   - **Risk:** Hvem som helst kan få admin-tilgang
   - **Fix:** Environment variable + Firebase Auth

3. **Permissive Firestore rules** - For åpen read/write tilgang
   - **Risk:** Data manipulation risk
   - **Fix:** Implementer bruker-basert authentication

### Best practices implementert
✅ HTTPS-only (Firebase Hosting enforces SSL)
✅ Environment variables for LINE token
✅ CORS protection (Cloud Functions)
✅ Input validation in Cloud Functions
✅ Error handling and logging

---

## 7. DEPLOYMENT & DEVELOPMENT

### lineApp (Web) Deployment
```bash
# Local development
python3 -m http.server 8000
# Visit: http://localhost:8000

# Production deployment
git add .
git commit -m "Your changes"
git push origin main  # Auto-deploys to GitHub Pages

# Deploy Cloud Functions (if changed)
firebase deploy --only functions
```

**Deployment targets:**
- Frontend: GitHub Pages (https://lapstuen.github.io/badminton-signup/)
- Backend: Firebase Cloud Functions

### BadmintonWalletManager Deployment
```bash
# Build for iOS Simulator
xcodebuild -project BadmintonWalletManager.xcodeproj \
  -scheme BadmintonWalletManager \
  -sdk iphonesimulator \
  -configuration Debug build

# Build for macOS (Mac Catalyst)
xcodebuild -project BadmintonWalletManager.xcodeproj \
  -scheme BadmintonWalletManager \
  -destination 'platform=macOS,variant=Mac Catalyst' \
  -configuration Debug build
```

---

## 8. VIKTIGE FILER

### lineApp (Web)
```
/Users/geirlapstuen/Swift/lineapp/
├─ index.html              # Main UI
├─ app.js                  # Main logic (~3000 lines)
├─ firebase-config.js      # Firebase SDK initialization
├─ style.css               # Styling
├─ manifest.json           # PWA manifest
├─ functions/
│  └─ index.js             # Cloud Functions (LINE notifications)
├─ CLAUDE.md               # Full project documentation
├─ TECHNICAL_OVERVIEW.md   # Architecture & technical details
├─ LINE_NOTIFICATIONS_SETUP.md  # LINE setup guide
├─ FIREBASE_SETUP.md       # Firebase configuration
└─ CHANGELOG.md            # Version history
```

### BadmintonWalletManager (iOS/Mac)
```
/Users/geirlapstuen/Swift/BadmintonWalletManager/
├─ BadmintonWalletManagerApp.swift
├─ Models/
│  ├─ User.swift
│  └─ Transaction.swift
├─ Views/
│  ├─ ContentView.swift
│  ├─ UserDetailView.swift
│  ├─ TransactionManagerView.swift
│  ├─ AllTransactionsView.swift
│  ├─ BackupView.swift
│  └─ NewUserView.swift
├─ Services/
│  └─ FirebaseManager.swift
└─ Utils/
   └─ FirebaseBackup.swift
```

---

## 9. VANLIGE OPPGAVER

### Legge til ny bruker (lineApp web admin)
1. Åpne admin panel (passord: `admin123`)
2. Klikk "Manage Authorized Users"
3. Fyll inn navn + eventuelt custom passord
4. Klikk "Add User"
5. Bruker får auto-generert UUID passord hvis ikke spesifisert

### Toppe opp wallet (begge apper)
**lineApp:**
1. Admin panel → "Manage Wallets"
2. Velg bruker fra dropdown
3. Skriv inn beløp (positivt tall)
4. Klikk "Update Wallet"

**BadmintonWalletManager:**
1. Åpne app → Klikk på bruker
2. Velg quick button (100, 150, 300 THB) eller custom amount
3. Klikk "Top Up"

### Starte ny session (lineApp)
1. Admin panel → "Start New Session"
2. Bekreft (sletter alle spillere fra forrige økt)
3. Session starter i draft mode
4. Setup regular players, juster detaljer
5. Klikk "Publish Session" når klar

### Publisere session (lineApp)
1. Admin panel → "Publish Session"
2. System:
   - Endrer published = true
   - Trekker fra wallet for spillere som ikke har betalt (paid = false)
   - Synlig for alle brukere

### Dele til LINE (lineApp)
1. Admin panel → "📤 Share to Line"
2. System sender session announcement til LINE gruppe
3. Viser øktdetaljer, ledige plasser, venteliste-info

---

## 10. FIREBASE KOSTNADER

### Free Tier Limits
| Service | Free Tier | Current Usage | Headroom |
|---------|-----------|---------------|----------|
| Firestore reads | 50K/day | ~20/day | ✅ **99.96% available** |
| Cloud Functions | 125K/month | ~16/month | ✅ **99.98% available** |
| Hosting | 10GB/month | ~100MB/month | ✅ **99% available** |
| LINE API | Free (no limit) | ~2-4/week | ✅ **Unlimited** |

**Konklusjon:** Kan støtte **400+ spillere/uke** uten å forlate free tier.

---

## 11. QUICK REFERENCE

### Important URLs
- **Production (lineApp):** https://lapstuen.github.io/badminton-signup/
- **GitHub Repo:** https://github.com/lapstuen/badminton-signup
- **Firebase Console:** https://console.firebase.google.com/project/badminton-b95ac

### Default Values
- Max players: **12**
- Payment amount: **150 THB**
- Admin password: **`admin123`** (hardcoded)
- Session ID format: **`YYYY-MM-DD`** (ISO date)

### Collection References (Firestore)
- `/sessions/{YYYY-MM-DD}` - Daily sessions
- `/sessions/{YYYY-MM-DD}/players/{playerId}` - Session players
- `/authorizedUsers/{userId}` - Authorized users with wallet
- `/transactions/{transactionId}` - Transaction history

### Wallet Balance Thresholds
- **Low (red):** balance < 150 THB
- **Medium (orange):** 150 ≤ balance < 450 THB
- **High (green):** balance ≥ 450 THB

---

## 12. SUMMARY

**lineApp** er hovedproduktet - en full-featured web-app for badminton session registration med wallet-system, LINE-varsler, og omfattende admin-panel.

**BadmintonWalletManager** er en companion iOS/Mac app fokusert på rask wallet-administrasjon for admins on-the-go.

**Begge apper** deler samme Firebase Firestore database og synkroniserer data i real-time.

**Neste steg for sikkerhet:**
1. Hash passwords (bcrypt)
2. Flytt admin password til environment variable
3. Implementer Firebase Authentication
4. Stram inn Firestore security rules

---

**Siste oppdatering:** 2025-11-13
**Dokument versjon:** 1.0
**Lagret for:** Claude Web (claude.ai)
