# Wyvern Drive

## What This Is

Wyvern Drive is a self-hosted, browser-based cloud storage solution that transforms Discord webhooks into a powerful, free file storage backend. It provides unlimited file storage using Discord's CDN, with full client-side AES-256-GCM encryption ensuring privacy — keys never leave the browser.

## Core Value

Files are stored securely (encrypted client-side) and can be retrieved reliably via Discord's CDN — zero cost, unlimited storage, complete privacy.

## Current Milestone: v2.0 Competitor Domination

**Goal:** Address every weakness the competitors (Disbox, Discloud) exposed and adopt their best ideas, making Wyvern Drive the definitive Discord-based storage client.

**Target features:**
- Concurrent upload pipeline (true parallel chunks via refactored RateLimiter)
- Service Worker streaming (Range request decryption for video/audio seeking)
- Encrypted metadata sync (multi-device backup/restore via Discord)
- Hardened rate limiter (concurrent queue + millisecond-safe backoff)
- CDN link refresh optimization (batch prefetch near expiry)

## Requirements

### Validated (v1.0)

- [x] Client-side AES-256-GCM encryption — keys never leave browser (Phase 1)
- [x] Unlimited file storage using Discord CDN via webhooks (Phase 1)
- [x] Smart chunking — 8MB chunks with parallel uploads (Phase 1)
- [x] Virtual scrolling — smooth performance with 10,000+ files (Phase 2)
- [x] Full folder system — create, rename, move, nested folders (Phase 2)
- [x] Drag & drop — intuitive file organization (Phase 2)
- [x] File versioning — keep history of document changes (Phase 2)
- [x] Advanced search — filter by name, type, date (Phase 2)
- [x] In-browser media streaming — preview images, videos, audio (Phase 3)
- [x] Persistent player — continuous playback across navigation (Phase 3)
- [x] Secure sharing — password-protected, time-limited links (Phase 3)
- [x] Photo timeline — Google Photos-style gallery view (Phase 3)
- [x] Discord-inspired dark theme, fully responsive (Phase 4)
- [x] WCAG AA compliant, keyboard navigable (Phase 4)
- [x] PWA ready — installable as native app on mobile/desktop (Phase 4)
- [x] Integration tests with mocked Discord API (Phase 4)
- [x] Self-hosted deployment — static files, no backend server (Phase 1)
- [x] Environment-based Discord webhook configuration (Phase 1)
- [x] Professional UI redesign — sidebar, grid/list, details drawer, floating player (Phase 5)
- [x] Theme tokens, iconography, motion/perf, visual discipline, AGENTS.md (Phases 6-10)

### Active (v2.0)

- [ ] Concurrent upload pipeline — true parallel chunk uploads
- [ ] Service Worker media streaming — Range request decryption
- [ ] Encrypted metadata sync — multi-device backup/restore
- [ ] Hardened rate limiter — concurrent queue + ms-safe backoff
- [ ] CDN link refresh optimization — batch prefetch

### Out of Scope

- Server-side storage/sync — Core design is client-side only
- Multi-user collaboration — Single-user storage tool
- Mobile native apps — PWA covers mobile use case
- Video transcoding — Browser cannot transcode; stream as-is
- Real-time file sync — No server for push notifications

## Context

- v1.0 milestone complete — 10 phases, 28 requirements, all verified
- Competitor research (Spikes 001-005) identified key gaps and advantages
- Discord webhooks allow sending files up to 25MB per message
- Discord CDN URLs expire after 24 hours — message IDs stored for refresh
- Browser-native encryption via Web Crypto API (AES-256-GCM)
- File metadata stored client-side (IndexedDB)
- Self-hosted: static files served via any web server or CDN
- GitHub remote: https://github.com/Zendevve/Wyvern-Drive.git

## Constraints

- **Tech stack**: Browser-only (no backend server) — all storage goes through Discord webhooks
- **File size**: Discord webhook limit is 25MB per file — requires chunking for larger files
- **Rate limits**: Discord API rate limits apply to webhook requests — must implement backoff
- **Security**: AES-256-GCM encryption with keys derived from user password via PBKDF2
- **Storage**: File metadata in IndexedDB (browser storage limits apply)
- **Deployment**: Static files only — can be hosted on any static hosting service

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Discord webhooks as storage backend | Free, unlimited CDN, no server needed | Validated (v1.0) |
| Client-side encryption (AES-256-GCM) | Privacy — keys never leave browser | Validated (v1.0) |
| Self-hosted deployment | User control, no third-party trust | Validated (v1.0) |
| @phosphor-icons/react for UI icons | MIT, tree-shakable, weight variants | Validated (Phase 7) |
| Self-hosted Clash Display + Satoshi fonts | No render-blocking third-party imports | Validated (Phase 8) |
| useReducedMotion hook for animation gating | Plain React + matchMedia; no framer-motion dep | Validated (Phase 8) |
| tokens.ts exports Tailwind class strings | Callers compose className directly | Validated (Phase 9) |
| Service Worker for encrypted media streaming | Enables Range requests on encrypted chunks without a backend | Pending (v2.0) |
| Encrypted IndexedDB export to Discord | Solves multi-device sync without a server | Pending (v2.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-04 — Milestone v2.0 started*
