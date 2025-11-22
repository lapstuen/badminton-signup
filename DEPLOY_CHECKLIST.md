# 🚀 DEPLOYMENT CHECKLIST

**⚠️ CRITICAL: Claude MUST read and follow this checklist EVERY TIME before git push!**

## ❗ Version Update (MANDATORY - Every Deploy)

**Problem:** Half of our deploys fail because version numbers are not updated consistently.

**Solution:** ALWAYS update all 3 locations!

### Option A: Automatic Script (RECOMMENDED)
```bash
./update-version.sh "v2025-11-22 12:00" "Description of changes"
```

This automatically updates:
1. ✅ Header version in index.html
2. ✅ Footer version in index.html
3. ✅ Cache-busting in script tags (app.js?v=... and firebase-config.js?v=...)

### Option B: Manual Update (ERROR-PRONE - Only if script fails)

**MUST update ALL THREE locations:**

1. **Header version** (index.html line ~29):
   ```html
   <p class="version-header">v2025-11-22 12:00 (Description)</p>
   ```

2. **Footer version** (index.html line ~130):
   ```html
   <p class="version">v2025-11-22 12:00 (Description)</p>
   ```

3. **Cache-busting** (index.html line ~400-403):
   ```html
   <script src="firebase-config.js?v=20251122-1200"></script>
   <script src="app.js?v=20251122-1200"></script>
   ```

   **⚠️ Format:** `v2025-11-22 12:00` → `20251122-1200` (remove "v", spaces, colons)

## Pre-Push Verification Checklist

- [ ] All three version locations updated?
- [ ] Cache-busting version matches timestamp?
- [ ] Changes tested on localhost?
- [ ] Git status clean (no unexpected files)?
- [ ] Backup created for major changes?

## Deploy Commands

```bash
# 1. Stage changes
git add .

# 2. Commit with proper message format
git commit -m "Brief description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. Push to GitHub (auto-deploys to GitHub Pages)
git push origin main

# 4. If Cloud Functions changed
firebase deploy --only functions
```

## Post-Deploy Verification

1. ✅ Check https://lapstuen.github.io/badminton-signup/
2. ✅ Verify version number visible in header (may take 1-2 minutes)
3. ✅ Hard refresh (Cmd+Shift+R) to clear cache
4. ✅ Test on iPhone/mobile if possible

## Common Mistakes to AVOID

❌ **Forgetting to update cache-busting version** (most common!)
❌ Updating only 1 or 2 of the 3 version locations
❌ Using wrong date format in cache-busting
❌ Not testing on localhost first
❌ Pushing without verifying git diff

## Browser Cache Issues

**Problem:** Users don't see new version even after deploy

**Why:** Browsers cache JavaScript aggressively

**Solutions:**
- **Chrome:** Worst for caching - Use Incognito or Developer Tools → Application → Clear Storage
- **Safari:** Better - "Empty Caches" in Develop menu
- **Firefox:** Better - "Disable Cache" in DevTools Network tab

**Our solution:** Cache-busting with `?v=timestamp` forces reload on version change

## Emergency Rollback

```bash
# View recent commits
git log --oneline -5

# Revert last commit
git revert HEAD
git push origin main

# Or revert to specific commit
git revert <commit-hash>
git push origin main
```

## Quick Reference

### Version Number Format
- **Display version:** `v2025-11-22 12:00` (shown to users)
- **Cache-busting:** `20251122-1200` (in script src)

### File Locations
- **Header:** index.html line ~29 (in `<header>`)
- **Footer:** index.html line ~130 (in `<footer>`)
- **Script tags:** index.html line ~400-403 (before `</body>`)

---

## 📋 Quick Deployment Template

**Use this for every deploy:**

1. Run: `./update-version.sh "v2025-11-22 HH:MM" "What changed"`
2. Verify: `git diff index.html` (check all 3 locations updated)
3. Stage: `git add .`
4. Commit: `git commit -m "Update version to vXXXX + description"`
5. Push: `git push origin main`
6. Wait 1-2 minutes for GitHub Pages
7. Test: Hard refresh in browser
8. Verify: Check version in header

---

**Remember: EVERY deploy MUST update version number in ALL 3 PLACES. No exceptions!**

**Last Updated:** 2025-11-22
