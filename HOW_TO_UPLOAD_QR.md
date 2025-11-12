# 📱 Slik laster du opp QR-koden

## Metode 1: Via GitHub Web (Enklest! ⭐)

### Steg 1: Lagre QR-kode bildet
1. Åpne PromptPay/Banking app på telefonen
2. Ta screenshot av QR-koden
3. Send bildet til deg selv (Line, Email, AirDrop)
4. Lagre bildet på datamaskinen
5. **Gi bildet navnet:** `payment-qr.png`
   - Eller bruk: `payment-qr.jpg` (hvis JPG format)

### Steg 2: Gå til GitHub
1. Åpne nettleser og gå til:
   ```
   https://github.com/lapstuen/badminton-signup
   ```

2. Logg inn hvis nødvendig

### Steg 3: Last opp filen
1. Klikk på knappen **"Add file"** (øverst til høyre)
2. Velg **"Upload files"**
3. Dra og slipp `payment-qr.png` inn i boksen
   - Eller klikk "choose your files" og velg filen

### Steg 4: Commit (lagre) endringen
1. Nederst på siden, skriv en beskrivelse:
   ```
   Add QR code for payments
   ```

2. Klikk den grønne knappen **"Commit changes"**

### Steg 5: Vent 1-2 minutter
- GitHub Pages bygger automatisk ny versjon
- Siden oppdateres automatisk på:
  ```
  https://lapstuen.github.io/badminton-signup/payment-info.html
  ```

## Metode 2: Via Terminal (for avanserte brukere)

```bash
# 1. Gå til lineapp mappen
cd /Users/geirlapstuen/Swift/lineapp

# 2. Kopier QR-kode bildet hit (dra det inn i Finder)
# Navnet MÅ være: payment-qr.png

# 3. Sjekk at filen er der
ls -la payment-qr.png

# 4. Legg til i git
git add payment-qr.png

# 5. Commit
git commit -m "Add QR code for payments"

# 6. Push til GitHub
git push origin main
```

## Metode 3: Hvis du bruker annet filnavn

Hvis du vil bruke et annet navn (f.eks. `qr-code.png`):

1. Last opp filen med hvilket som helst navn
2. Gå til `payment-info.html` på GitHub
3. Klikk blyant-ikonet (✏️) for å redigere
4. Finn linje 203:
   ```html
   <img src="payment-qr.png" alt="...">
   ```
5. Endre til ditt filnavn:
   ```html
   <img src="qr-code.png" alt="...">
   ```
6. Klikk "Commit changes"

## 🎨 Hvis QR-koden er for stor/liten

Etter opplasting, hvis størrelsen ikke er bra:

1. Gå til `payment-info.html` på GitHub
2. Finn linje 98:
   ```css
   .qr-container img {
       max-width: 100%;
   ```
3. Endre til f.eks.:
   ```css
   max-width: 80%;  /* Gjør den mindre */
   max-width: 300px; /* Fast bredde */
   ```

## ✅ Slik sjekker du om det virket

1. Åpne: `https://lapstuen.github.io/badminton-signup/payment-info.html`
2. Hvis du ser QR-koden → **Suksess!** 🎉
3. Hvis du ser "รอการอัปโหลด QR Code" → Filen er ikke lastet opp ennå

## ❓ Trenger du hjelp?

Hvis noe ikke fungerer:
1. Sjekk at filnavnet er **nøyaktig**: `payment-qr.png` (små bokstaver!)
2. Sjekk at filen er i **root** (hovedmappen), ikke i en undermappe
3. Vent 2-3 minutter etter commit for at GitHub Pages skal bygge

## 📂 Hvor ligger filen?

På GitHub: `https://github.com/lapstuen/badminton-signup/blob/main/payment-qr.png`

Lokalt: `/Users/geirlapstuen/Swift/lineapp/payment-qr.png`
