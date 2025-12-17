# Extension Repository Branch Strategy

> **Repository:** https://github.com/Zendevve/wyvern-extension
> **Status:** Open source
> **Current State:** Has multiple branches (`extension` and `extension-public`)

---

## Recommendation: Merge to Single Branch ✅

### Why Merge?

**Current situation:**
- `extension-public` = Has README (user-facing)
- `extension` = Development branch (same code?)

**Problems with dual branches:**
1. **Sync burden** — Need to keep both updated
2. **Confusion** — Which is source of truth?
3. **Wasted effort** — Maintaining two identical branches

**Benefits of single branch:**
1. ✅ **Simplicity** — One source of truth
2. ✅ **Industry standard** — Most OSS projects use one primary branch
3. ✅ **No divergence** — Can't get out of sync
4. ✅ **Clear workflow** — All development happens in one place

---

## Recommended Workflow

### Step 1: Merge Branches

```bash
cd /path/to/wyvern-extension

# Ensure you're on extension-public
git checkout extension-public

# Merge extension into extension-public
git merge extension

# Push merged result
git push origin extension-public
```

### Step 2: Rename to `main`

```bash
# Rename extension-public to main
git branch -m extension-public main

# Push and set upstream
git push origin -u main

# Update default branch on GitHub
# (Go to repo settings → Branches → Change default branch to "main")
```

### Step 3: Clean Up

```bash
# Delete old branches (after confirming merge worked)
git push origin --delete extension
git push origin --delete extension-public  # After renaming to main

# Delete local branches
git branch -d extension
```

---

## Proposed Branch Strategy

### Single Branch Model (Recommended for Extensions)

```
main (default)
├── All development happens here
├── Tag releases: v1.0.0, v1.1.0, etc.
└── Chrome Web Store gets code from tags
```

**Why this works:**
- Extensions are simple (no server-side complexity)
- Users install from Chrome Web Store, not GitHub
- GitHub code is for developers/contributors only
- Tags mark stable releases

### Example Workflow

```bash
# Development
git checkout main
# ... make changes ...
git commit -m "feat: add new feature"
git push origin main

# Release
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# Submit v1.2.0 to Chrome Web Store
```

---

## Alternative: Feature Branch Model

If you want more structure:

```
main (stable - what users see)
├── develop (active development)
└── feature/xyz (individual features)
```

**Workflow:**
1. Create feature branch from `develop`
2. Merge feature → `develop` when done
3. Merge `develop` → `main` for releases
4. Tag `main` for Chrome Web Store

**When to use:**
- Multiple contributors
- Need staging/testing period
- Large features that take time

**For a solo/small team extension:** Probably overkill.

---

## Migration Plan

### Phase 1: Audit (Today)

- [ ] Check if `extension` and `extension-public` have different content
  ```bash
  git diff extension extension-public
  ```
- [ ] If identical → merge immediately
- [ ] If different → understand why first

### Phase 2: Merge (This Week)

- [ ] Back up current state (just in case)
  ```bash
  git clone https://github.com/Zendevve/wyvern-extension wyvern-extension-backup
  ```
- [ ] Merge `extension` → `extension-public`
- [ ] Verify everything works
- [ ] Delete `extension` branch

### Phase 3: Rename (This Week)

- [ ] Rename `extension-public` → `main`
- [ ] Update GitHub default branch
- [ ] Update any CI/CD references
- [ ] Update documentation

### Phase 4: Tag (Going Forward)

- [ ] Create tags for releases
  ```bash
  git tag -a v1.0.0 -m "First stable release"
  git push origin v1.0.0
  ```

---

## Key Differences: Extension vs. Web App

| Aspect | Extension (Open Source) | Web App (Private) |
|--------|------------------------|-------------------|
| **Visibility** | Public GitHub | Private repo |
| **Distribution** | Chrome Web Store | Netlify deployment |
| **Branch Strategy** | Single `main` branch | Can use develop/staging if needed |
| **Versioning** | Semantic tags (v1.0.0) | Internal versioning |
| **Contributors** | Community welcome | Team only |

---

## Final Recommendation

**Do this:**
1. ✅ Merge `extension` → `extension-public` (eliminate duplication)
2. ✅ Rename `extension-public` → `main` (follow standard naming)
3. ✅ Use tags for releases (v1.0.0, v1.1.0, etc.)
4. ✅ Keep it simple (no develop branch unless you need it)

**Avoid:**
- ❌ Multiple branches with same content
- ❌ Complex Git-flow for a browser extension
- ❌ Manual sync between branches

---

**Status:** Ready to implement
**Risk:** Low (can always revert if needed)
**Time:** 15 minutes
