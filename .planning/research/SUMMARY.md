# Research Summary: Wyvern Drive

## Recommended Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | Vite 6 + React 19 | No server → Next.js is overkill |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix UI | Discord-inspired dark theme |
| **State** | Zustand | Lightweight, async-friendly |
| **Metadata** | IndexedDB via Dexie.js | `idb` alternative; supports compound indexes |
| **Encryption** | Native Web Crypto API (AES-256-GCM) | No `crypto-js` — hardware-accelerated, zero deps |
| **Virtual Scroll** | TanStack Virtual v3 | Variable row heights, 100K+ items |
| **PWA** | vite-plugin-pwa (Workbox) | Prompt strategy for update control |
| **Testing** | Vitest v4.1 + Playwright + MSW v2 | MSW mocks Discord API at network level |

## Table Stakes vs Differentiators

**Table stakes (14 features):** Upload/download, folders, file CRUD, search, sort/filter, icons, dark theme, responsive layout, accessibility (WCAG AA), PWA, error handling/toasts. These must ship in v1.

**Differentiators (11 features):** Client-side AES-256-GCM encryption (zero-knowledge), Discord webhook/CDN backend (unlimited free storage), 25MB chunking with parallel uploads, secure sharing (password + time-limited links via URL fragment), file versioning, photo timeline gallery, media streaming with inline preview, persistent audio player, virtual scrolling for 10K+ files, drag-and-drop file moves.

**Anti-features (12 exclusions):** No real-time collab, no desktop sync, no native apps, no office doc preview, no photo editing, no WebDAV/SFTP, no AI/ML. Every exclusion saves months of work.

## Architecture Overview

Wyvern Drive is a **client-only PWA with zero server cost**. All logic lives in the browser: React + Zustand for UI/state, a dedicated Web Worker for AES-256-GCM encryption via PBKDF2-derived keys, IndexedDB (Dexie.js) for metadata (files, folders, chunks, versions, shares), and Discord webhooks + CDN as the remote storage layer. The upload pipeline encrypts files, splits them into ≤25MB chunks, uploads each via webhook (`?wait=true` for message confirmation), and stores message IDs in IndexedDB. Downloads re-fetch messages to get fresh signed CDN URLs, then decrypt chunks client-side. Critical design principles: UI never touches Discord APIs or crypto directly — everything routes through a service layer; encryption runs off-main-thread in Web Workers; metadata stays local (IndexedDB) while file bytes stay remote (Discord CDN); share links encode encrypted payloads in the URL fragment (`#`) so nothing is sent to a server.

## Top 5 Pitfalls to Avoid

1. **Nonce/IV reuse in AES-GCM** — Reusing a nonce under the same key completely breaks encryption. Use per-file key derivation, random 96-bit nonces prepended to every chunk, and never reuse derived keys across files.
2. **CDN URL expiration without refresh** — Discord attachment URLs expire silently. Store webhook message IDs (not just URLs) and implement URL refresh by re-fetching messages via the webhook API.
3. **Browser data loss = total data loss** — Clearing browser data destroys all metadata and key material. Implement key export/import to encrypted `.wdkey` files, show persistent warnings, and support a recovery phrase for the master password.
4. **IndexedDB quota exhaustion** — Browsers enforce quotas (Safari ~1GB). Monitor `navigator.storage.estimate()`, warn at 80% quota, never store file data in IndexedDB (only metadata), and handle `QuotaExceededError` in all write paths.
5. **Chunk upload failure cascade** — One failed chunk can corrupt the entire file. Track per-chunk status, implement chunk-level retry with idempotent naming, show chunk-level progress, and support resume from last successful chunk.

## Key Decisions Needed Before Implementation

1. **Discord webhook file size limit** — Default is **10MB** per upload, not 25MB. 25MB requires Nitro/boosted servers. Chunk size should default to **8MB** (leaves room for multipart overhead) and be dynamically reducible on 400 errors. Confirm: target free accounts (8MB) or Nitro users (25MB)?
2. **IndexedDB wrapper** — Research recommends `idb` (STACK.md) but architecture spec uses Dexie.js. Pick one and standardize.
3. **CORS for media streaming** — Discord CDN does not send CORS headers. Video/audio streaming from CDN URLs will fail without a proxy or service worker intercept. Decide: proxy approach, download-then-play, or accept limited media preview?
4. **iOS PWA limitations** — No push notifications, ~50MB service worker cache, ~1GB IndexedDB (may be evicted), service workers killed after 30s background. Accept degraded iOS experience or plan mitigations?
5. **Deployment origin stability** — IndexedDB is same-origin bound. Any domain/port change creates a new empty database. Lock down a stable deployment origin from day one.

## Critical Corrections from Research

- **Discord file upload limit is 10MB by default, not 25MB** — The PROJECT.md and FEATURES.md reference 25MB as the safe default, but Discord's actual default limit is **10MiB per file**. 25MB requires Nitro subscription or boosted server. Chunk sizing must account for this (8MB recommended for safe margin with multipart overhead).
- **`idb` vs Dexie.js inconsistency** — STACK.md recommends `idb` (v8) while ARCHITECTURE.md specifies Dexie.js for the full schema. These are different libraries with different APIs. Must reconcile.
- **Discord CDN URLs expire** — Stored URLs in IndexedDB go stale. The app must store message IDs and re-fetch fresh URLs on access. This is a core architectural requirement, not an edge case.
- **Webhook names must not contain `clyde` or `discord`** — Discord rejects webhook names with these substrings.
- **Discord API must use v10** — Earlier versions are deprecated/discontinued. Pin to `https://discord.com/api/v10/...` everywhere.
