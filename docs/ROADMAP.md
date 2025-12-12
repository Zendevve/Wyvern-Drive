# Wyvern Drive — Master Roadmap v2

> **Mission:** The definitive Discord-based infinite encrypted storage.
> **Timeline:** Late 2025 – Q2 2026

---

## Phase 1: Foundation ✅
*Core engine that proves the concept works.*

### 1.1 Core Upload Engine ✅
- [x] File chunking (7.5MB per chunk)
- [x] Upload to Discord via webhook
- [x] Store chunk URLs in metadata DB

### 1.2 Core Download Engine ✅
- [x] Fetch chunk URLs from metadata
- [x] Download via extension (CORS bypass)
- [x] Reassemble original file

### 1.3 Encryption Layer ✅
- [x] AES-256-GCM encryption
- [x] Per-session key derivation (PBKDF2)
- [x] Salt storage per file

### 1.4 Virtual File System ✅
- [x] SQLite metadata database
- [x] Hierarchical folder structure
- [x] File versioning support

---

## Phase 2: Power User Ops ✅
*Make file management actually usable.*

### 2.1 File Operations ✅
- [x] Rename files/folders
- [x] Move files between folders
- [x] Delete with recursive support

### 2.2 Batch Operations ✅
- [x] Multi-select (Ctrl+Click)
- [x] Batch drag-drop move
- [x] Batch delete (store action)

### 2.3 UI Polish (Deferred)
- [ ] Selection toolbar
- [ ] Transfer speed/ETA display
- [ ] Keyboard shortcuts

---

## Phase 3: Search & Navigation
*Find your files without scrolling forever.*

### 3.1 Navigation
- [ ] Breadcrumb trail component
- [ ] Click-to-navigate folders
- [ ] "Up" button / keyboard nav

### 3.2 Search
- [ ] Fuzzy search input (Fuse.js)
- [ ] Highlight matches in results
- [ ] Search within current folder or global

### 3.3 Filtering & Sorting
- [ ] Filter by: type, size range, date range
- [ ] Sort by: name, size, date, type
- [ ] Persist user preferences

### 3.4 Quick Access
- [ ] Recent files section
- [ ] Starred/pinned files
- [ ] Last opened folders

---

## Phase 4: Media Center
*Stream, view, listen without downloading.*

### 4.1 Image Handling
- [ ] Lightbox with zoom/pan
- [ ] Thumbnail grid (lazy load)
- [ ] EXIF metadata viewer
- [ ] Slideshow mode

### 4.2 Audio Player
- [ ] Play encrypted audio (decrypt on fly)
- [ ] Seekable progress bar
- [ ] Queue/playlist support
- [ ] Mini-player widget

### 4.3 Video Streaming
- [ ] Sequential chunk streaming
- [ ] Buffer ahead for smooth playback
- [ ] Quality selector (if transcoding added)

### 4.4 Caching
- [ ] IndexedDB thumbnail cache
- [ ] LRU eviction policy
- [ ] Cache invalidation on file update

---

## Phase 5: Deployment & Infrastructure
*Go from localhost to production.*

### 5.1 Database Migration
- [ ] Evaluate: SQLite → Turso or Postgres
- [ ] Migration scripts
- [ ] Connection pooling

### 5.2 Backend Deployment
- [ ] Railway/Render/Fly.io setup
- [ ] Environment variables (secrets)
- [ ] Health check endpoint

### 5.3 Frontend Deployment
- [ ] Netlify/Vercel build config
- [ ] API URL environment toggle
- [ ] Preview deployments

### 5.4 Extension Distribution
- [ ] Chrome Web Store listing
- [ ] Auto-update manifest
- [ ] Firefox port (optional)

---

## Phase 6: Security Hardening
*Make it actually secure, not just encrypted.*

### 6.1 Obfuscation
- [ ] UUID filenames on Discord
- [ ] Randomized chunk ordering
- [ ] Steganography option

### 6.2 Key Management
- [ ] Password change flow
- [ ] Re-encryption pipeline
- [ ] Key backup/export

### 6.3 Redundancy
- [ ] Multi-webhook upload (RAID-1)
- [ ] Self-heal scan
- [ ] Integrity verification

---

## Phase 7: Sync & Sharing
*Use it across devices, share with others.*

### 7.1 Multi-Device Sync
- [ ] Folder watcher (file system monitor)
- [ ] Conflict resolution
- [ ] Sync status indicator

### 7.2 Sharing
- [ ] Ephemeral links (time-limited)
- [ ] Password-protected shares
- [ ] QR code generation

---

## Phase 8-10: Future
*Desktop app, mobile, API, ecosystem.*

*(Details to be expanded when earlier phases complete)*

---

## Milestones

| Target | Deliverable |
|--------|-------------|
| **Dec 2025** | Phases 1-4 (usable daily driver) |
| **Jan 2026** | Phase 5 (deployed hybrid) |
| **Feb 2026** | Phase 6-7 (secure + shareable) |
| **Q2 2026** | Desktop/Mobile/API |
