# Roadmap: Wyvern Drive

**Phases:** 4 | **Requirements:** 22 | **Coverage:** 100% ✓

## Overview

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|--------------|-------|
| 1 | Core Storage Engine | File upload/download with encryption works end-to-end | Complete    | 2026-06-03 |
| 2 | File Management | Folder system, versioning, search, virtual scrolling | Complete    | 2026-06-03 |
| 3 | Media & Sharing | In-browser streaming, persistent player, secure sharing, photo timeline | MEDIA-01, MEDIA-02, SHAR-01, SHAR-02 | 1 |
| 4 | Polish & Ship | Production UI, accessibility, PWA, test coverage | UI-01, UI-02, UI-03, TEST-01, TEST-02 | 1 |

## Phase Details

### Phase 1: Core Storage Engine

**Goal:** User can upload, encrypt, chunk, and download files via Discord webhooks — the entire storage pipeline works end-to-end.

**Requirements:**
- STRG-01: Client-side AES-256-GCM encryption (PBKDF2 600K iterations)
- STRG-02: Unlimited file storage via Discord CDN webhooks
- STRG-03: Smart chunking (8MB default) with parallel uploads
- INFRA-01: Self-hosted deployment (static files)
- INFRA-02: Environment-based webhook configuration
- INFRA-03: Discord API rate limit handling with backoff
- INFRA-04: CDN URL refresh via stored message IDs

**Success Criteria:**
1. User can configure Discord webhook URL and validate it works
2. User can upload any file size — it chunks, encrypts, and sends to Discord
3. Files are encrypted with AES-256-GCM before leaving the browser
4. Large files (>8MB) split into chunks and upload in parallel with progress indicator
5. User can download files — chunks are fetched, decrypted, and reassembled
6. Rate limit errors (429) trigger automatic backoff and retry
7. App deployed as static files with no backend server

**Plans:** 1/1 plans complete

---

### Phase 2: File Management

**Goal:** Organize files in folders, track versions, search effectively, and handle 10K+ files smoothly.

**Requirements:**
- FILE-01: Full folder system (create, rename, delete, move, nested)
- FILE-02: Drag & drop file/folder organization
- FILE-03: File versioning with history
- FILE-04: Advanced search (name, type, date, folder)
- STRG-04: Virtual scrolling for 10K+ files

**Success Criteria:**
1. User can create, rename, delete, and move folders (including nested)
2. User can drag files and folders to reorganize them
3. File versions are tracked — user can view and restore previous versions
4. Search filters files by name, type, date, and current folder
5. File browser renders 10K+ items smoothly via virtual scrolling (no jank)

**Plans:** 1/1 plans complete

---

### Phase 3: Media & Sharing

**Goal:** Preview media in-browser, play audio continuously across navigation, share files securely, and browse photos chronologically.

**Requirements:**
- MEDIA-01: In-browser media streaming (images, video, audio)
- MEDIA-02: Persistent audio player across navigation
- SHAR-01: Password-protected, time-limited share links
- SHAR-02: Photo timeline (Google Photos-style gallery)

**Success Criteria:**
1. Images display inline, videos play in-browser, audio plays with custom player
2. Audio player persists and continues playing when navigating to other pages
3. Share links can be generated with password protection and expiration time
4. Photo timeline shows images in chronological grid layout

**Plans:** 1 (media & sharing features implementation)

---

### Phase 4: Polish & Ship

**Goal:** Production-ready dark theme UI, full accessibility, PWA installability, and comprehensive test coverage.

**Requirements:**
- UI-01: Discord-inspired dark theme, fully responsive
- UI-02: WCAG AA accessible, keyboard navigable
- UI-03: PWA ready (service worker, manifest, installable)
- TEST-01: Integration tests with mocked Discord API
- TEST-02: E2E tests with Playwright

**Success Criteria:**
1. Dark theme responsive across all viewports (mobile to desktop)
2. All interactive elements keyboard accessible, screen reader compatible
3. PWA installs on mobile and desktop via service worker + manifest
4. Integration tests pass for upload/download/encryption with mocked Discord API
5. E2E tests cover core user journeys via Playwright

**Plans:** 1 (UI polish, accessibility, PWA, and testing)

---

## Dependency Graph

```
Phase 1: Core Storage Engine
    ↓
Phase 2: File Management
    ↓
Phase 3: Media & Sharing
    ↓
Phase 4: Polish & Ship
```

All phases are sequential — each builds on the previous.

---
*Roadmap created: 2026-06-03*
*Last updated: 2026-06-03 after initialization*
