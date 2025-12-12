# Deployment Architecture

## Current Stack
- **Frontend:** Vite + React (static)
- **Backend:** Express + SQLite (stateful)
- **Extension:** Chrome Manifest V3

---

## SQLite: Limitation Analysis

### Current Situation
SQLite stores file metadata locally in `wyvern.db`. This works perfectly for:
- Single-user, single-machine use
- Electron desktop app

### Limitations for Hybrid/Cloud
| Issue | Impact |
|-------|--------|
| **File-based storage** | Can't share DB across instances |
| **No concurrent writes** | Multiple users = data corruption risk |
| **No built-in replication** | Device sync requires manual export |

### Solutions

| Option | Effort | Best For |
|--------|--------|----------|
| **Turso** (SQLite edge) | Low | Keep SQLite syntax, serverless |
| **Postgres** (Railway) | Medium | Multi-user, scalable |
| **PlanetScale** (MySQL) | Medium | Branching, serverless |
| **Supabase** (Postgres) | Medium | Auth + DB combo |

**Recommendation:** Start with **Railway + Postgres**. It's free tier friendly, you keep Express, and migration is straightforward.

---

## Hybrid Deployment Plan

### Frontend → Netlify
```
wyvern-web/
├── netlify.toml          # Build config
├── .env.production       # VITE_API_URL=https://your-railway-app.railway.app
```

### Backend → Railway
```
wyvern-server/
├── Procfile              # web: npm start
├── railway.json          # Config
├── .env.production       # DATABASE_URL=postgres://...
```

### Migration Steps

1. **Add Postgres schema migration**
   - Use Drizzle ORM or raw SQL migrations
   - Same schema, different dialect

2. **Update server to use `pg` instead of `better-sqlite3`**
   - Connection pooling via `pg-pool`
   - Environment toggle for local dev (SQLite) vs prod (Postgres)

3. **Deploy backend to Railway**
   - Connect GitHub repo
   - Add Postgres addon
   - Set environment variables

4. **Deploy frontend to Netlify**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Set `VITE_API_URL` env var

5. **Update extension** (if needed)
   - Ensure it works with remote API
   - Publish to Chrome Web Store

---

## Recommended Tech Stack (Hybrid)

| Layer | Local Dev | Production |
|-------|-----------|------------|
| Frontend | Vite dev server | Netlify |
| API | Express + SQLite | Railway + Postgres |
| DB | SQLite file | Railway Postgres |
| Extension | Unpacked | Chrome Web Store |

---

## Next Action
1. Add Postgres support to `wyvern-server`
2. Create migration script
3. Deploy to Railway (backend)
4. Deploy to Netlify (frontend)
