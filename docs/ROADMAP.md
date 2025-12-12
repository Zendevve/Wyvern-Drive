# Wyvern Drive — Master Roadmap

> **Mission:** Build the definitive, infinite, encrypted cloud storage leveraging Discord.
> **Timeline:** Late 2025 (Phased Rollout)

---

## Phase 1: Foundation ✅ (Complete)
- [x] Core upload/download engine with chunking
- [x] AES-GCM encryption
- [x] Virtual file system (SQLite metadata)
- [x] Basic UI (Grid/List views)
- [x] Git remote backup & recovery

---

## Phase 2: Power User File Ops ✅ (Complete)
- [x] File/Folder Move & Rename
- [x] Batch selection state (Zustand)
- [x] Multi-select drag & drop
- [x] Ctrl+Click selection UI
- [ ] *(Deferred)* Batch action toolbar
- [ ] *(Deferred)* Enhanced transfer status

---

## Phase 3: Search & Navigation
- [ ] Breadcrumb navigation for folder traversal
- [ ] Client-side fuzzy search (filename, extension)
- [ ] Filter panel (by type, size, date range)
- [ ] Sort options (name, size, date, type)
- [ ] "Recent Files" quick access section

---

## Phase 4: Media Center
- [ ] Image lightbox with zoom/pan
- [ ] Audio player with playlist, seeking, volume
- [ ] Video streaming (sequential chunk fetch)
- [ ] Thumbnail caching (IndexedDB)
- [ ] EXIF/metadata viewer for images

---

## Phase 5: Fort Knox Security
- [ ] Filename obfuscation (UUID-based names on Discord)
- [ ] Steganography mode (embed data in valid images)
- [ ] Key rotation (re-encrypt with new password)
- [ ] Password change flow (re-key all files)
- [ ] 2-channel redundancy (RAID-like parity)
- [ ] Self-heal scan (detect deleted Discord msgs, re-upload)

---

## Phase 6: Sync & Sharing
- [ ] Sync folder watcher (auto-upload on file change)
- [ ] Ephemeral share links (time-limited, password-protected)
- [ ] QR code sharing for mobile
- [ ] Collaborative vaults (multi-user access via shared key)

---

## Phase 7: Desktop & CLI
- [ ] System tray integration (background sync)
- [ ] Native notifications (upload/download complete)
- [ ] CLI tool (`wyvern upload ./folder`)
- [ ] Headless mode for servers

---

## Phase 8: Polish & Ecosystem
- [ ] Theming engine (dark/light/custom palettes)
- [ ] Plugin system (community extensions)
- [ ] PWA optimization (offline capability, mobile install)
- [ ] Onboarding wizard (first-time setup)
- [ ] Usage analytics dashboard (storage used, upload history)

---

## Phase 9: Advanced Features
- [ ] File deduplication (hash-based)
- [ ] Compression before encryption (zstd)
- [ ] Scheduled backups (cron-like)
- [ ] Trash/recycle bin (soft delete with restore)
- [ ] Activity log (who accessed what, when)

---

## Phase 10: Mobile & Beyond
- [ ] React Native app (iOS/Android)
- [ ] Offline-first sync (queue uploads when back online)
- [ ] Cross-device clipboard (share files instantly)
- [ ] Wyvern API (developer access for integrations)

---

## Milestones

| Milestone | Target | Key Deliverable |
|-----------|--------|-----------------|
| **Alpha** | Mid-Dec 2025 | Phases 1-4 complete, usable daily |
| **Beta** | Jan 2026 | Security features, sharing |
| **v1.0** | Feb 2026 | Desktop app, CLI, stable |
| **v2.0** | Q2 2026 | Mobile app, API, ecosystem |
