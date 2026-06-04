# Requirements: Wyvern Drive

**Defined:** 2026-06-03
**Core Value:** Files stored securely via Discord CDN — zero cost, unlimited, encrypted

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Storage & Performance

- [ ] **STRG-01**: Client-side AES-256-GCM encryption — encryption/decryption keys never leave browser, derived from user password via PBKDF2 (600K iterations)
- [ ] **STRG-02**: Unlimited file storage using Discord CDN via webhooks — files sent as webhook attachments
- [ ] **STRG-03**: Smart chunking — files split into dynamic chunks (default 8MB, configurable) with parallel uploads and progress tracking
- [ ] **STRG-04**: Virtual scrolling — smooth performance with 10,000+ files in file browser

### File Management

- [ ] **FILE-01**: Full folder system — create, rename, delete, move nested folders
- [ ] **FILE-02**: Drag & drop — intuitive file and folder organization via drag and drop
- [ ] **FILE-03**: File versioning — keep history of document changes with version metadata
- [ ] **FILE-04**: Advanced search — filter files by name, type, date, and folder

### Media & Sharing

- [ ] **MEDIA-01**: In-browser media streaming — preview images, play videos, and play audio directly in browser from Discord CDN
- [ ] **MEDIA-02**: Persistent audio player — continuous audio playback across page navigation
- [ ] **SHAR-01**: Secure sharing — generate password-protected, time-limited share links
- [ ] **SHAR-02**: Photo timeline — Google Photos-style chronological gallery view

### User Interface

- [ ] **UI-01**: Discord-inspired dark theme — fully responsive design down to mobile
- [ ] **UI-02**: WCAG AA accessible — keyboard navigable throughout, screen reader support
- [ ] **UI-03**: PWA ready — installable as native app on mobile and desktop via service worker
- [ ] **UI-04**: Collapsible left sidebar navigation dashboard layout
- [ ] **UI-05**: Dual light and dark theme styling using modern slate/zinc CSS variable tokens and glassmorphism
- [ ] **UI-06**: Toggleable Grid and List views in FileBrowser with inline folder pills
- [ ] **UI-07**: Right-side collapsible details drawer panel for file metadata, inline versions list, and inline sharing config
- [ ] **UI-08**: Persistent audio player floating dock with mini and expanded modes
- [ ] **UI-09**: Window-level global drag-and-drop upload overlay

### Infrastructure

- [ ] **INFRA-01**: Self-hosted deployment — static files only, no backend server required
- [ ] **INFRA-02**: Environment-based Discord webhook configuration — webhook URL configurable via .env or settings UI
- [ ] **INFRA-03**: Rate limit handling — Discord API rate limit compliance with backoff and retry
- [ ] **INFRA-04**: CDN URL refresh — store message IDs to re-fetch fresh signed URLs when Discord CDN links expire

### Testing

- [ ] **TEST-01**: Integration tests — mocked Discord API (MSW) for upload/download/encryption flows
- [ ] **TEST-02**: E2E tests — Playwright tests for core user journeys

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: WebDAV protocol support for desktop app integration
- **ADV-02**: File deduplication across uploads
- **ADV-03**: Batch upload/download operations
- **ADV-04**: File preview for documents (PDF, Office) without download

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side storage/sync | Core design is client-side only — no backend |
| Multi-user collaboration | Single-user storage tool |
| Mobile native apps | PWA covers mobile use case |
| Video transcoding | Browser cannot transcode; stream as-is |
| Real-time file sync | No server for push notifications |
| AI-powered features | Out of scope for v1 |
| WebDAV server | Deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRG-01 | Phase 1 | Pending |
| STRG-02 | Phase 1 | Pending |
| STRG-03 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| FILE-01 | Phase 2 | Pending |
| FILE-02 | Phase 2 | Pending |
| FILE-03 | Phase 2 | Pending |
| FILE-04 | Phase 2 | Pending |
| STRG-04 | Phase 2 | Pending |
| MEDIA-01 | Phase 3 | Pending |
| MEDIA-02 | Phase 3 | Pending |
| SHAR-01 | Phase 3 | Pending |
| SHAR-02 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 5 | Pending |
| UI-05 | Phase 5 | Pending |
| UI-06 | Phase 5 | Pending |
| UI-07 | Phase 5 | Pending |
| UI-08 | Phase 5 | Pending |
| UI-09 | Phase 5 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-04 after UI redesign definition*
