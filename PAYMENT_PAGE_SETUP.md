# Payment Information Page Setup

## Overview

A static payment information page has been created at `payment-info.html`. This page displays:
- Thai QR Payment code
- Bank account details
- Step-by-step payment instructions
- Beautiful responsive design

## Setup Steps

### 1. Add QR Code Image

You need to add your QR code image to the repository:

```bash
# Save your QR code image from the screenshot as:
# payment-qr.jpg

# Place it in the same directory as index.html:
/Users/geirlapstuen/Swift/lineapp/payment-qr.jpg
```

**Supported formats:** `.jpg`, `.jpeg`, `.png`

If you use a different filename, update line 94 in `payment-info.html`:
```html
<img src="payment-qr.jpg" alt="Thai QR Payment - Krungthai Bank">
```

### 2. Update Bank Account Number

Edit `payment-info.html` and replace the placeholder account number:

**Line 165:**
```html
<span class="bank-value account-number">XXX-X-XXXXX-X</span>
```

Replace `XXX-X-XXXXX-X` with the actual account number.

### 3. Update Account Name (if needed)

**Line 161:**
```html
<span class="bank-value">น.ส.สุรีย์ ลาพสตูเอน</span>
```

Update if the account name is different.

### 4. Deploy to GitHub Pages

```bash
# 1. Add all files
git add payment-info.html payment-qr.jpg

# 2. Commit
git commit -m "Add payment information page with QR code

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. Push to GitHub (auto-deploys to GitHub Pages)
git push origin main
```

### 5. Access the Page

Once deployed, the page will be available at:

**URL:** `https://lapstuen.github.io/badminton-signup/payment-info.html`

## How It Works

1. **In "Close Last Session" summary**, users with low balance (<150 THB) see a clickable link
2. **Link text:** "คลิกที่นี่เพื่อดูข้อมูลการชำระเงิน / Click here for payment information"
3. **Opens in new tab** with complete payment instructions
4. **Mobile-friendly** design with gradient background

## Page Features

✅ **Responsive design** - Works on all devices
✅ **Thai + English** - Bilingual content
✅ **QR Code display** - Large, easy to scan
✅ **Bank details** - Complete account information
✅ **Step-by-step instructions** - How to top up wallet
✅ **Back button** - Returns to main app
✅ **Beautiful UI** - Gradient background, clean layout

## File Locations

```
/Users/geirlapstuen/Swift/lineapp/
├── payment-info.html          ← Payment page (created)
├── payment-qr.jpg             ← QR code image (YOU NEED TO ADD THIS)
├── app.js                     ← Updated with link
└── index.html                 ← Main app
```

## Testing Locally

```bash
# Start local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/payment-info.html
```

## Customization

### Change Colors

Edit the CSS gradient in `payment-info.html`:

```css
/* Header and button gradient (line 16, 24, 164) */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Change QR Code Size

Edit line 98 in `payment-info.html`:

```css
.qr-container img {
    max-width: 100%;  /* Change to 80%, 90%, etc. */
}
```

### Add More Instructions

Edit the `.instructions` section (lines 230-244) in `payment-info.html`.

## Security Notes

⚠️ **Public Information**: This page is publicly accessible on the internet.
- Only include information you're comfortable sharing publicly
- Do not include sensitive personal information
- The QR code is already public in your Line group

## Need Help?

If you need to change anything, edit:
- **Bank details:** Lines 153-167 in `payment-info.html`
- **QR image:** Line 94 in `payment-info.html`
- **Instructions:** Lines 230-244 in `payment-info.html`
- **Link text:** Line 759 in `app.js`
