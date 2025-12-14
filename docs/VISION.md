# Wyvern Drive — Vision Document

> **Goal:** Become the definitive, end-all-be-all Discord-based storage solution.

---

## Competitive Landscape

| Project | Pros | Cons |
|---------|------|------|
| **DDrive** | Pioneer, proven | Abandoned, no encryption, basic UI |
| **Discord-fs** | CLI-based | No GUI, limited features |
| **DiscordFS** | Multiple webhook support | PHP backend, dated |

### Wyvern Drive's Advantages (Today)
- ✅ Client-side AES-256-GCM encryption
- ✅ Modern React UI with Discord aesthetic
- ✅ Folder operations with versioning
- ✅ Dynamic chunk sizing (boost-aware)
- ✅ Share links with expiry + password
- ✅ Serverless (Supabase Edge)

---

## Differentiation Roadmap

### 🥇 Tier 1: Core Superiority
*Things competitors don't have*

| Feature | Impact | Effort |
|---------|--------|--------|
| **Zero-knowledge encryption** | Users own their data, we can't see it | ✅ Done |
| **Deduplication** | Hash-based chunk dedup across files | Medium |
| **Delta sync** | Only upload changed chunks (rsync-style) | High |
| **Compression** | Gzip/Brotli before encryption | Low |

### 🥈 Tier 2: Platform Expansion
*Meet users where they are*

| Feature | Impact | Effort |
|---------|--------|--------|
| **Desktop App** | Electron wrapper, file sync, tray icon | Medium |
| **Mobile PWA** | iOS/Android installable, offline-capable | Medium |
| **CLI Tool** | Headless uploads, scripting, backups | Low |
| **WebDAV/S3 Gateway** | Mount as drive, use with any app | High |

### 🥉 Tier 3: Ecosystem Lock-in
*Make switching impossible*

| Feature | Impact | Effort |
|---------|--------|--------|
| **Automatic Backup** | Watch folders, scheduled backups | Medium |
| **Photo Library** | Smart albums, face detection, timeline | High |
| **Document Search** | Full-text search in PDFs, docs | Medium |
| **File Requests** | Let others upload to your drive | Low |

---

## Killer Features (High-Impact Ideas)

### 1. 🗄️ Vault Mode
Encrypted container files that can be shared as single units. Like VeraCrypt but cloud-native.

### 2. 🔄 Sync Client
Desktop app that syncs a local folder ↔ Wyvern Drive. Dropbox-style experience.

### 3. 📸 Photo Timeline
Automatic organization by date, location, EXIF data. Gallery view with lazy loading.

### 4. 🎵 Music Library
Album/artist organization, playlist support, Spotify-like experience for your own music.

### 5. 📺 Watch Together
Stream video to multiple users simultaneously. Discord screen share but for stored videos.

### 6. 🌐 Public File Hosting
Serve static websites, images, or files directly from Wyvern Drive. Like GitHub Pages.

### 7. 🔐 Team Vaults
Shared encrypted spaces with access control. Google Drive sharing but zero-knowledge.

---

## Quick Wins (Implement Now)

1. **gzip compression** — Compress before chunking (easy 20-40% size reduction for text)
2. **Drag-out downloads** — Drag file from browser directly to desktop
3. **Paste upload** — Ctrl+V to upload clipboard images
4. **Storage analytics** — Charts showing space by file type, upload trends
5. **Bulk operations** — Select all, invert selection, move/delete in batch

---

## Extension Elimination (Future)

Long-term goal: Remove extension requirement via:
1. **Firefox First** — Firefox allows less restrictive CORS for extensions
2. **Native Messaging** — Desktop app handles fetches, browser connects via WebSocket
3. **Cloudflare Worker** — Streaming proxy (may work for smaller chunks)

---

## Monetization (If Desired)

| Model | Description |
|-------|-------------|
| **Freemium** | Free tier with limits (e.g., 50GB), paid for unlimited |
| **Hosted Instance** | Pay for managed Wyvern Drive without self-hosting |
| **Enterprise** | Team features, audit logs, SSO |
| **Donations** | Open-source with GitHub Sponsors / Ko-fi |

---

## North Star Metric

> **"Time to first successful upload for a new user"**

If someone can install the extension and upload their first file in under 2 minutes, we win.
