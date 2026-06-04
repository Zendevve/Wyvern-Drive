# Requirements: Wyvern Drive

**Defined:** 2026-06-03 (v1.0), Updated: 2026-06-04 (v2.0)
**Core Value:** Files stored securely via Discord CDN - zero cost, unlimited, encrypted

## v2.0 Requirements

Requirements for milestone v2.0: Competitor Domination. Each maps to roadmap phases.

### Concurrency & Rate Limiting

- [ ] **CONC-01**: User can upload files with true parallel chunk uploads (configurable concurrency degree, default 3) - RateLimiter processes N tasks simultaneously instead of serializing
- [ ] **CONC-02**: Rate limiter correctly converts Discord's `x-ratelimit-reset-after` (seconds) to milliseconds before sleeping - no cascading 429 errors
- [ ] **CONC-03**: Rate limiter uses pre-emptive header tracking (`X-RateLimit-Remaining`, `X-RateLimit-Reset-After`) to avoid hitting 429s proactively

### Media Streaming

- [ ] **STRM-01**: User can seek within encrypted video files - Service Worker intercepts media requests and responds with decrypted partial content (`206 Partial Content`)
- [ ] **STRM-02**: User can seek within encrypted audio files - same Service Worker streaming with Range header support
- [ ] **STRM-03**: Service Worker maps byte ranges to encrypted chunk boundaries, fetches only the required chunks, decrypts on-the-fly, and pipes to the response

### Multi-Device Sync

- [ ] **SYNC-01**: User can export encrypted metadata backup - serializes IndexedDB state, encrypts with user key, uploads to a designated Discord message
- [ ] **SYNC-02**: User can import encrypted metadata backup - downloads from Discord, decrypts, and restores IndexedDB state on a new device
- [ ] **SYNC-03**: Backup includes file records, folder hierarchy, chunk mappings, and share configurations - full state restoration

### CDN Optimization

- [ ] **CDN-01**: System batch-prefetches fresh CDN URLs for files whose cached URLs are approaching expiry (within 2-hour buffer window)
- [ ] **CDN-02**: CDN refresh uses webhook message API (`GET /webhooks/{id}/{token}/messages/{messageId}`) to fetch fresh attachment URLs efficiently

## v1.0 Requirements (Validated)

### Storage & Performance

- [x] **STRG-01**: Client-side AES-256-GCM encryption (Phase 1)
- [x] **STRG-02**: Unlimited file storage using Discord CDN via webhooks (Phase 1)
- [x] **STRG-03**: Smart chunking with parallel uploads (Phase 1)
- [x] **STRG-04**: Virtual scrolling for 10K+ files (Phase 2)

### File Management

- [x] **FILE-01**: Full folder system (Phase 2)
- [x] **FILE-02**: Drag & drop organization (Phase 2)
- [x] **FILE-03**: File versioning (Phase 2)
- [x] **FILE-04**: Advanced search (Phase 2)

### Media & Sharing

- [x] **MEDIA-01**: In-browser media streaming (Phase 3)
- [x] **MEDIA-02**: Persistent audio player (Phase 3)
- [x] **SHAR-01**: Secure sharing (Phase 3)
- [x] **SHAR-02**: Photo timeline (Phase 3)

### User Interface

- [x] **UI-01**: Dark theme, responsive (Phase 4)
- [x] **UI-02**: WCAG AA accessible (Phase 4)
- [x] **UI-03**: PWA ready (Phase 4)
- [x] **UI-04**: Sidebar navigation (Phase 5)
- [x] **UI-05**: Dual light/dark theme tokens (Phase 5)
- [x] **UI-06**: Grid/List file views (Phase 5)
- [x] **UI-07**: Details drawer (Phase 5)
- [x] **UI-08**: Floating audio player (Phase 5)
- [x] **UI-09**: Global drag-drop overlay (Phase 5)

### Infrastructure

- [x] **INFRA-01**: Self-hosted deployment (Phase 1)
- [x] **INFRA-02**: Webhook configuration (Phase 1)
- [x] **INFRA-03**: Rate limit handling (Phase 1)
- [x] **INFRA-04**: CDN URL refresh (Phase 1)

### Testing

- [x] **TEST-01**: Integration tests (Phase 4)
- [x] **TEST-02**: E2E tests (Phase 4)

## Future Requirements

Deferred beyond v2.0.

- **ADV-01**: WebDAV protocol support for desktop app integration
- **ADV-02**: File deduplication across uploads
- **ADV-03**: Batch upload/download operations
- **ADV-04**: File preview for documents (PDF, Office) without download

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side storage/sync | Core design is client-side only |
| Multi-user collaboration | Single-user storage tool |
| Mobile native apps | PWA covers mobile use case |
| Video transcoding | Browser cannot transcode; stream as-is |
| Real-time file sync | No server for push notifications |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONC-01 | Phase 11 | Pending |
| CONC-02 | Phase 11 | Pending |
| CONC-03 | Phase 11 | Pending |
| STRM-01 | Phase 12 | Pending |
| STRM-02 | Phase 12 | Pending |
| STRM-03 | Phase 12 | Pending |
| SYNC-01 | Phase 13 | Pending |
| SYNC-02 | Phase 13 | Pending |
| SYNC-03 | Phase 13 | Pending |
| CDN-01 | Phase 14 | Pending |
| CDN-02 | Phase 14 | Pending |

**Coverage:**

- v2.0 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-04 - v2.0 requirements added*
