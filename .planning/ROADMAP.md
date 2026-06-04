# Roadmap: Wyvern Drive v2.0

**Phases:** 4 | **Requirements:** 11 | **Coverage:** 100%

## Overview

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|--------------|-------|
| 11 | Concurrent Upload Pipeline | True parallel chunk uploads with hardened rate limiting | CONC-01, CONC-02, CONC-03 | Not started |
| 12 | Service Worker Streaming | Encrypted media seeking via Range request decryption | STRM-01, STRM-02, STRM-03 | Not started |
| 13 | Encrypted Metadata Sync | Multi-device backup/restore via Discord | SYNC-01, SYNC-02, SYNC-03 | Not started |
| 14 | CDN Refresh Optimization | Batch prefetch expiring URLs proactively | CDN-01, CDN-02 | Not started |

## Phase Details

### Phase 11: Concurrent Upload Pipeline

**Goal:** Refactor the RateLimiter to support true concurrent task execution (configurable degree, default 3) with pre-emptive rate-limit header tracking and millisecond-safe backoff, unlocking parallel chunk uploads that were previously serialized.

**Requirements:**

- CONC-01: True parallel chunk uploads with configurable concurrency
- CONC-02: Millisecond-safe rate-limit reset conversion
- CONC-03: Pre-emptive header tracking to avoid 429s

**Success Criteria:**

1. `RateLimiter` accepts a `concurrencyLimit` parameter and processes up to N tasks simultaneously
2. Uploading a 40MB file (5 chunks) spawns 3 parallel upload requests visible in the Network tab
3. `retryAfter` from Discord headers is always multiplied by 1000 before sleeping
4. Pre-emptive tracking reads `X-RateLimit-Remaining` and pauses before exhausting the bucket
5. All existing unit tests pass; new tests cover concurrent execution and rate-limit conversion
6. `npm run build` exits 0

**Depends on:** None (first v2.0 phase)

---

### Phase 12: Service Worker Streaming

**Goal:** Implement a Service Worker that intercepts media file requests, maps byte ranges to encrypted chunk boundaries, fetches and decrypts only the required chunks, and responds with `206 Partial Content` - enabling video/audio seeking without downloading the entire file.

**Requirements:**

- STRM-01: Video seeking via Service Worker decrypted Range responses
- STRM-02: Audio seeking via the same Service Worker mechanism
- STRM-03: Byte-range-to-chunk mapping with on-the-fly decryption

**Success Criteria:**

1. A new Service Worker file intercepts requests matching `/stream/{fileId}` routes
2. Video files play in the browser with working seek (clicking the timeline jumps to the correct position)
3. Audio files play with working seek in the persistent audio player
4. Service Worker correctly maps a requested byte range to the relevant encrypted chunk(s), decrypts, and returns only the requested bytes
5. `Content-Range` and `206 Partial Content` headers are set correctly on streaming responses
6. Fallback: if Service Worker is unavailable, full-file download still works
7. All existing tests pass; `npm run build` exits 0

**Depends on:** Phase 11 (uses hardened rate limiter for chunk fetching)

---

### Phase 13: Encrypted Metadata Sync

**Goal:** Allow users to export their entire IndexedDB state (files, folders, chunks, shares) as an encrypted payload uploaded to Discord, and import it on another device to restore full access to their file library without re-uploading anything.

**Requirements:**

- SYNC-01: Encrypted metadata export to Discord
- SYNC-02: Encrypted metadata import from Discord
- SYNC-03: Complete state restoration (files, folders, chunks, shares)

**Success Criteria:**

1. User can trigger "Export Backup" from settings - IndexedDB is serialized, encrypted with user's key, and uploaded as a Discord message attachment
2. User can trigger "Import Backup" on a new browser - enters backup message ID (or scans a list), downloads, decrypts, and restores IndexedDB
3. After import, the file browser shows the same folder hierarchy, file metadata, and share configurations as the source device
4. Downloading files from the imported state works correctly (chunk message IDs resolve to fresh CDN URLs)
5. Export/import handles databases with 1000+ file records without browser memory issues
6. All existing tests pass; `npm run build` exits 0

**Depends on:** Phase 11 (rate limiter for Discord API calls during export/import)

---

### Phase 14: CDN Refresh Optimization

**Goal:** Proactively batch-refresh CDN URLs for files approaching their 24-hour expiry window, preventing stale-URL download failures before the user encounters them.

**Requirements:**

- CDN-01: Batch prefetch URLs within 2-hour expiry buffer
- CDN-02: Efficient webhook message API usage for URL refresh

**Success Criteria:**

1. A background task scans IndexedDB for chunks with CDN URLs expiring within 2 hours
2. Expiring URLs are refreshed in batches (respecting rate limits) via `GET /webhooks/{id}/{token}/messages/{messageId}`
3. Fresh URLs and new expiry timestamps are written back to IndexedDB
4. The refresh runs automatically on app start and periodically (configurable interval, default 30 minutes)
5. Rate limiter ensures batch refresh does not conflict with active user operations (uploads/downloads)
6. All existing tests pass; `npm run build` exits 0

**Depends on:** Phase 11 (concurrent rate limiter), Phase 12 (Service Worker uses refreshed URLs)

---

## Dependency Graph

```
Phase 11: Concurrent Upload Pipeline
    ↓
Phase 12: Service Worker Streaming
    ↓
Phase 13: Encrypted Metadata Sync
    ↓
Phase 14: CDN Refresh Optimization
```

---
*Roadmap created: 2026-06-04*
*Milestone: v2.0 Competitor Domination*
