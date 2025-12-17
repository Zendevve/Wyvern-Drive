# Deployment Guide

> **Last Updated:** 2025-12-18
> **Maintainer:** Development Team

---

## Overview

Wyvern Drive uses a multi-platform deployment strategy:
- **Web App:** Netlify (static hosting)
- **Backend:** Supabase (managed PostgreSQL + Edge Functions)
- **Extension:** Chrome Web Store

---

## Prerequisites

### Required Accounts

- [ ] GitHub account (code repository)
- [ ] Netlify account (web hosting)
- [ ] Supabase account (backend)
- [ ] Discord account (webhooks)
- [ ] Google Chrome Developer account (extension publishing)

### Required Tools

```bash
# Node.js and npm
node --version  # Should be >= 18.x
npm --version   # Should be >= 9.x

# Supabase CLI
npm install -g supabase
supabase --version

# Git
git --version
```

---

## 1. Supabase Deployment

### Initial Setup

**1.1: Create Supabase Project**

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region (closest to users)
4. Set database password (store securely)

**1.2: Apply Database Schema**

```bash
cd "d:\COMPROG\Wyvern Drive"

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

**1.3: Configure Row-Level Security**

```sql
-- Enable RLS on all tables
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own files
CREATE POLICY "Users can view own files"
  ON files FOR SELECT
  USING (auth.uid() = user_id);

-- (Additional policies in supabase/migrations/)
```

### Edge Functions Deployment

**2.1: Deploy Functions**

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy file-operations
```

**2.2: Set Environment Variables**

```bash
# Set secrets for Edge Functions
supabase secrets set DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Database Backups

**Automatic:** Supabase Pro plan includes daily backups
**Manual:**

```bash
# Export database
supabase db dump -f backup.sql

# Restore from backup
supabase db reset --db-url "postgresql://..."
```

---

## 2. Web App Deployment (Netlify)

### Initial Setup

**1.1: Connect GitHub Repository**

1. Go to [netlify.com](https://netlify.com)
2. New site from Git
3. Connect to GitHub repository: `Zendevve/Wyvern-Drive`
4. Configure build settings:
   - **Base directory:** `wyvern-web`
   - **Build command:** `npm run build`
   - **Publish directory:** `wyvern-web/dist`

**1.2: Set Environment Variables**

In Netlify dashboard → Site settings → Environment variables:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

**1.3: Configure Custom Domain (Optional)**

1. Netlify → Domain settings
2. Add custom domain
3. Configure DNS (CNAME or A record)
4. Enable HTTPS (automatic via Let's Encrypt)

### Continuous Deployment

**Automatic Deployment:**

- Every push to `main` branch triggers deployment
- Preview deployments for pull requests
- Rollback available via Netlify dashboard

**Manual Deployment:**

```bash
cd wyvern-web

# Build locally
npm run build

# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Build Configuration

The `netlify.toml` file in the repository root configures:

```toml
[build]
  base = "wyvern-web"
  command = "npm run build"
  publish = "wyvern-web/dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 3. Chrome Extension Deployment

### Build Extension

```bash
cd wyvern-extension

# Ensure manifest.json is up to date
# Increment version number for updates
```

**Create ZIP Package:**

```bash
# Windows PowerShell
Compress-Archive -Path wyvern-extension\* -DestinationPath wyvern-extension.zip

# macOS/Linux
zip -r wyvern-extension.zip wyvern-extension/
```

### Chrome Web Store Submission

**Initial Submission:**

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer fee (if not done)
3. Click "New Item"
4. Upload `wyvern-extension.zip`
5. Fill out listing details:
   - Name: "Wyvern Drive"
   - Description: (See `wyvern-extension/README.md`)
   - Icon: 128x128 PNG
   - Screenshots: 1280x800 or 640x400 PNG
6. Select category: "Productivity"
7. Submit for review

**Updates:**

1. Increment `version` in `manifest.json`
2. Rebuild ZIP
3. Upload to existing listing
4. Submit for review (typically 1-3 business days)

### Extension Permissions

Current permissions (declared in `manifest.json`):

```json
{
  "permissions": [
    "storage",        // Store auth tokens
    "contextMenus"    // Right-click menu integration
  ],
  "host_permissions": [
    "https://*.supabase.co/*"  // API access
  ]
}
```

> [!WARNING]
> Adding new permissions requires user re-approval upon update.

---

## 4. Environment Variables

### Web App (Netlify)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | `eyJh...` |

### Edge Functions (Supabase)

| Variable | Description | Source |
|----------|-------------|--------|
| `DISCORD_WEBHOOK_URL` | Discord webhook for large uploads | Discord server settings |

### Local Development

Create `.env` files:

**`wyvern-web/.env`:**

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

> [!CAUTION]
> Never commit `.env` files to Git. They are in `.gitignore`.

---

## 5. Rollback Procedures

### Web App Rollback

**Via Netlify Dashboard:**

1. Deployments tab
2. Find previous successful deployment
3. Click "Publish deploy"

**Via Git:**

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard COMMIT_HASH
git push --force origin main
```

### Database Rollback

```bash
# Revert last migration
supabase migration repair --status reverted MIGRATION_VERSION

# Apply older migration
supabase db reset
```

### Extension Rollback

1. Chrome Web Store dashboard
2. Re-upload previous version ZIP
3. Submit for review (expedited for critical bugs)

---

## 6. Deployment Checklist

### Pre-Deployment

- [ ] All tests pass locally (`npm test`)
- [ ] Linter clean (`npm run lint`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Feature docs updated
- [ ] `ROADMAP.md` updated if applicable

### Post-Deployment

- [ ] Web app loads correctly
- [ ] File upload/download works
- [ ] Authentication flow works
- [ ] Extension connects to updated backend
- [ ] No console errors
- [ ] Monitoring dashboards show healthy metrics

---

## 7. Deployment Schedule

**Web App:**
- **Automatic:** Every push to `main`
- **Staging:** PR preview deployments

**Edge Functions:**
- **Manual:** On-demand via `supabase functions deploy`

**Extension:**
- **Manual:** Major releases only (1-2 weeks review time)

---

## Related Documentation

- **Architecture:** [System Overview](file:///d:/COMPROG/Wyvern%20Drive/docs/Architecture/system-overview.md)
- **Operations:** [Monitoring](file:///d:/COMPROG/Wyvern%20Drive/docs/Operations/monitoring.md)
- **Development:** [Setup Guide](file:///d:/COMPROG/Wyvern%20Drive/docs/Development/setup.md)
