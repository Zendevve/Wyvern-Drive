# Wyvern Drive — Project Initialization Plan

## Overview

**Project:** Wyvern Drive — Discord-based cloud storage with unlimited space, zero cost, and client-side encryption.
**Remote:** https://github.com/Zendevve/Wyvern-Drive.git
**Branch:** `master` (clean slate — old code archived to `archive-v1`)
**Mode:** Auto (YOLO) | **Granularity:** Coarse | **Parallelization:** Yes

---

## Context

Wyvern Drive transforms Discord webhooks into a powerful, free cloud storage solution. The user provided a comprehensive feature list covering storage/performance, file management, media/sharing, and developer experience. This is a **greenfield rebuild** — previous code was archived to `archive-v1` branch.

**Core Value:** Users can store, manage, and files using Discord's CDN as a free, unlimited backend — with full client-side encryption ensuring privacy.

---

## Config

**File:** `.planning/config.json`

```json
{
  "mode": "yolo",
  "granularity": "coarse",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "inherit",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": false,
    "auto_advance": true
  }
}
```

---

## Step-by-Step Execution Plan

### Step 1: Create Planning Directory & Config

1. `mkdir -p .planning`
2. Create `.planning/config.json` with the config above
3. Commit: `chore: add project config`

### Step 2: Create PROJECT.md

**File:** `.planning/PROJECT.md`

Synthesize from the user's feature document:

- **What This Is:** Discord-based cloud storage — self-hosted web app that uses Discord webhooks/CDN as backend for unlimited file storage with client-side AES-256-GCM encryption.
- **Core Value:** Files are stored securely (encrypted client-side) and can be retrieved reliably via Discord's CDN — zero cost, unlimited storage.
- **Constraints:** Self-hosted, browser-based (no server component for storage), Discord API rate limits, 25MB file size limit per Discord message (hence chunking).

**Key Decisions:**
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Discord webhooks as storage backend | Free, unlimited CDN, no server needed | — Pending |
| Client-side encryption (AES-256-GCM) | Privacy — keys never leave browser | — Pending |
| Self-hosted deployment | User control, no third-party trust | — Pending |
| Coarse granularity for phases | Feature set is comprehensive, fewer broader phases | — Pending |

**Requirements initialized as hypotheses** (greenfield — all are Active until validated):
- Storage & Performance: encryption, unlimited storage, smart chunking, virtual scrolling
- File Management: folder system, drag & drop, versioning, search
- Media & Sharing: streaming, persistent player, secure sharing, photo timeline
- Developer Experience: dark theme UI, accessibility, PWA, testing

**Commit:** `docs: initialize project`

### Step 3: Research (4 parallel agents via task tool)

Spawn 4 researchers in parallel using the `task` tool:

1. **Stack Research** → `.planning/research/STACK.md`
   - Standard 2025 stack for browser-based file storage apps
   - Discord API/webhook integration patterns
   - Client-side encryption libraries (Web Crypto API, AES-256-GCM)
   - Virtual scrolling implementations
   - PWA setup patterns
   - **Recommended stack:** React/Next.js, Web Crypto API, IndexedDB, Tailwind CSS

2. **Features Research** → `.planning/research/FEATURES.md`
   - Table stakes for cloud storage (upload, download, folders, search)
   - Differentiators (encryption, Discord CDN, photo timeline)
   - Anti-features (server-side processing — explicitly excluded)

3. **Architecture Research** → `.planning/research/ARCHITECTURE.md`
   - Client-side architecture patterns (no backend server)
   - Discord webhook/CDN integration architecture
   - Chunking and parallel upload patterns
   - File metadata management (IndexedDB/localStorage)
   - Build order dependencies

4. **Pitfalls Research** → `.planning/research/PITFALLS.md`
   - Discord API rate limits (critical — can lose data)
   - Discord CDN URL expiration (webhook attachments expire after some time)
   - Browser storage limits for metadata
   - Large file handling in browser (memory pressure)
   - Encryption key management in browser (localStorage vs IndexedDB)

**Synthesize** → `.planning/research/SUMMARY.md` (after all 4 complete)

**Commit:** `docs: add domain research`

### Step 4: Define Requirements

**File:** `.planning/REQUIREMENTS.md`

Based on the feature document, all requirements are v1 (auto mode includes all table stakes + features from document).

#### v1 Requirements

**Storage & Performance**
- [ ] **STRG-01**: Client-side AES-256-GCM encryption — encryption/decryption keys never leave browser
- [ ] **STRG-02**: Unlimited file storage using Discord CDN via webhooks
- [ ] **STRG-03**: Smart chunking — files split into dynamic 25MB chunks with parallel uploads
- [ ] **STRG-04**: Virtual scrolling — smooth performance with 10,000+ files

**File Management**
- [ ] **FILE-01**: Full folder system — create, rename, move, nested folders
- [ ] **FILE-02**: Drag & drop — intuitive file organization between folders
- [ ] **FILE-03**: File versioning — keep history of document changes
- [ ] **FILE-04**: Advanced search — filter by name, type, date

**Media & Sharing**
- [ ] **MEDIA-01**: In-browser media streaming — preview images, videos, audio
- [ ] **MEDIA-02**: Persistent player — continuous playback across navigation
- [ ] **SHAR-01**: Secure sharing — password-protected, time-limited links
- [ ] **SHAR-02**: Photo timeline — Google Photos-style gallery view

**Developer Experience / UI**
- [ ] **UI-01**: Discord-inspired dark theme, fully responsive
- [ ] **UI-02**: WCAG AA compliant, keyboard navigable
- [ ] **UI-03**: PWA ready — installable as native app on mobile/desktop
- [ ] **TEST-01**: Integration tests with mocked Discord API

**Infrastructure**
- [ ] **INFRA-01**: Self-hosted deployment (static files — no backend server)
- [ ] **INFRA-02**: Environment-based Discord webhook configuration

#### v2 Requirements
None — feature document describes complete v1 scope.

#### Out of Scope
| Feature | Reason |
|---------|--------|
| Server-side storage/sync | Core design is client-side only |
| Multi-user collaboration | Single-user storage tool |
| Mobile native apps | PWA covers mobile use case |
| Video transcoding | Browser cannot transcode; stream as-is |
| Real-time file sync | No server for push notifications |

**Commit:** `docs: define v1 requirements`

### Step 5: Create Roadmap

Spawn roadmapper agent via `task` tool with all context.

**File:** `.planning/ROADMAP.md`

### Proposed Roadmap (Coarse — 4 phases)

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Core Storage Engine | File upload/download with encryption works | STRG-01, STRG-02, STRG-03, INFRA-01, INFRA-02 | 5 criteria |
| 2 | File Management | Folder system, versioning, search | FILE-01, FILE-02, FILE-03, FILE-04, STRG-04 | 5 criteria |
| 3 | Media & Sharing | Streaming, playback, sharing | MEDIA-01, MEDIA-02, SHAR-01, SHAR-02 | 4 criteria |
| 4 | Polish & Ship | UI/UX, accessibility, PWA, tests | UI-01, UI-02, UI-03, TEST-01 | 4 criteria |

**Phase 1: Core Storage Engine**
Goal: User can upload, encrypt, chunk, and download files via Discord webhooks
Requirements: STRG-01, STRG-02, STRG-03, INFRA-01, INFRA-02
Success criteria:
1. Webhook URL configuration and validation
2. File upload sends encrypted chunks to Discord via webhooks
3. AES-256-GCM encryption/decryption in browser (Web Crypto API)
4. Files >25MB split into chunks and uploaded in parallel
5. Download retrieves chunks from Discord CDN, decrypts, and reassembles

**Phase 2: File Management**
Goal: Organize files in folders, track versions, search, handle scale
Requirements: FILE-01, FILE-02, FILE-03, FILE-04, STRG-04
Success criteria:
1. Create, rename, delete, move folders (nested)
2. Drag & drop files between folders
3. Version history tracked and viewable
4. Search filters by name, type, date
5. Virtual scrolling handles 10K+ items

**Phase 3: Media & Sharing**
Goal: Preview media in-browser, persistent playback, secure sharing
Requirements: MEDIA-01, MEDIA-02, SHAR-01, SHAR-02
Success criteria:
1. Image viewer, video player, audio player in-browser
2. Audio player persists and continues across page navigation
3. Share links with password protection and expiration
4. Photo timeline gallery view

**Phase 4: Polish & Ship**
Goal: Production-ready UI, accessibility, PWA, test coverage
Requirements: UI-01, UI-02, UI-03, TEST-01
Success criteria:
1. Discord-inspired dark theme, responsive down to mobile
2. Keyboard navigable, WCAG AA compliant
3. PWA manifest + service worker installable
4. Integration tests with mocked Discord API

**Commit:** `docs: create roadmap (4 phases)`

### Step 6: Create STATE.md

**File:** `.planning/STATE.md`

### Step 7: Generate GEMINI.md

Run `gsd-tools.cjs generate-claude-md` to create project guide.

**Commit included in Step 5 commit.**

---

## Critical Pitfalls to Address During Execution

1. **Discord webhook rate limits** — Discord limits webhook requests (typically 30/minute). Research exact limits and implement backoff/retry.
2. **CDN URL expiration** — Discord CDN URLs for webhook attachments may expire. Research expiration policy and implement refresh mechanism.
3. **File metadata storage** — Since this is client-side only, file metadata (names, folders, versions, encryption nonces) must be stored in IndexedDB or localStorage. Plan capacity limits.
4. **Memory pressure** — Large file chunking in-browser can cause memory issues. Implement streaming/chunked processing.
5. **Key recovery** — If user clears browser data, encrypted files are unrecoverable. Implement key export/import mechanism.

---

## Next Step

After all artifacts are created and committed:

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```

Run: `/gsd-discuss-phase 1 --auto`
