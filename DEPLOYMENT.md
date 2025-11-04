# Deployment Guide

## Automated Deployment Scripts

The project includes automated deployment scripts that handle version numbering and Firebase deployment.

### Quick Start

**For most deployments (frontend only):**
```bash
./deploy-hosting.sh
```

**For full deployment (frontend + functions):**
```bash
./deploy.sh
```

---

## Scripts Overview

### 1. `deploy-hosting.sh` ⚡ (Recommended for daily use)

**Use this for:** Regular updates to HTML/CSS/JS

**What it does:**
1. ✅ Auto-updates version number with current timestamp
2. ✅ Deploys to Firebase Hosting (frontend only)
3. ✅ Commits version change to git
4. ✅ Pushes to GitHub

**Speed:** ~20-30 seconds

**Example:**
```bash
./deploy-hosting.sh
```

**Output:**
```
🚀 Quick deployment (hosting only)...
📅 Version: 2025-11-05 02:00
📝 Updating version number...
✅ Version updated to: 2025-11-05 02:00
🔥 Deploying hosting to Firebase...
✔  Deploy complete!
🎉 Deployment complete!
🌐 Live at: https://badminton-b95ac.web.app
```

---

### 2. `deploy.sh` 🚀 (Full deployment)

**Use this for:** Updates that include Cloud Functions changes

**What it does:**
1. ✅ Auto-updates version number
2. ✅ Deploys EVERYTHING (hosting + functions)
3. ✅ Commits version change to git
4. ✅ Pushes to GitHub

**Speed:** ~60-90 seconds (slower due to function deployment)

**Example:**
```bash
./deploy.sh
```

---

## Manual Deployment (Old Way)

If you prefer manual deployment:

```bash
# 1. Update version manually in index.html
# Edit line 73: <p class="version">Version: YYYY-MM-DD HH:MM</p>

# 2. Deploy
npx firebase deploy --only hosting

# 3. Commit
git add index.html
git commit -m "Update version"
git push
```

---

## When to Use Which Script

| Scenario | Script | Reason |
|----------|--------|--------|
| Changed HTML/CSS/JS | `deploy-hosting.sh` | Faster |
| Changed `app.js` | `deploy-hosting.sh` | Faster |
| Changed Cloud Function | `deploy.sh` | Need to deploy functions |
| Changed `functions/index.js` | `deploy.sh` | Need to deploy functions |
| Regular updates | `deploy-hosting.sh` | Daily workflow |
| After Line integration changes | `deploy.sh` | Functions changed |

---

## Version Numbering

Version format: `YYYY-MM-DD HH:MM`

**Examples:**
- `2025-11-05 01:49`
- `2025-11-05 14:30`

**Location:** `index.html` line 73

**Purpose:**
- Users can see when the app was last updated
- Helps with debugging ("what version are you on?")
- Cache busting (users know to refresh)

---

## Troubleshooting

### Script won't run: "Permission denied"

**Fix:**
```bash
chmod +x deploy.sh
chmod +x deploy-hosting.sh
```

### Firebase login required

**Fix:**
```bash
npx firebase login
```

### Git conflicts

**Fix:**
```bash
git pull
# Resolve conflicts
./deploy-hosting.sh
```

### Wrong timestamp (timezone)

The scripts use your system time. If timezone is wrong:

**macOS:**
```bash
sudo systemsetup -settimezone Asia/Bangkok
```

---

## Advanced Usage

### Deploy without version update

If you want to deploy WITHOUT updating version:

```bash
npx firebase deploy --only hosting
```

### Deploy specific function

```bash
npx firebase deploy --only functions:sendCancellationNotification
```

### View deployment history

```bash
npx firebase hosting:channel:list
```

---

## CI/CD Integration (Future)

For GitHub Actions automated deployment:

```yaml
name: Deploy to Firebase
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g firebase-tools
      - run: ./deploy-hosting.sh
```

---

## Rollback

If deployment goes wrong:

```bash
# View recent deployments
npx firebase hosting:channel:list

# Rollback in Firebase Console
# Go to: Hosting → Release history → "Rollback"
```

---

## Monitoring

After deployment, check:

1. **Firebase Console:** https://console.firebase.google.com/project/badminton-b95ac/hosting
2. **Live Site:** https://badminton-b95ac.web.app
3. **Browser Console:** F12 → Check for errors
4. **Version Number:** Should match your deployment time

---

## Best Practices

✅ **Always test locally first:**
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

✅ **Commit code changes before deploying:**
```bash
git add .
git commit -m "Your changes"
./deploy-hosting.sh
```

✅ **Use `deploy-hosting.sh` for speed** (90% of deployments)

✅ **Check Firebase logs after deploy:**
```bash
npx firebase functions:log
```

✅ **Test in incognito/private window** (avoids cache issues)

---

## Quick Reference

```bash
# Most common command (use this 90% of the time)
./deploy-hosting.sh

# When you changed Cloud Functions
./deploy.sh

# Check what will be deployed
git status

# View recent commits
git log --oneline -5

# View Firebase hosting deployments
npx firebase hosting:channel:list
```

---

**Last Updated:** 2025-11-05
**Scripts Version:** 1.0
