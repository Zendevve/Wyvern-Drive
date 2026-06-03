# Wyvern Drive

## What This Is

Wyvern Drive is a self-hosted, browser-based cloud storage solution that transforms Discord webhooks into a powerful, free file storage backend. It provides unlimited file storage using Discord's CDN, with full client-side AES-256-GCM encryption ensuring privacy — keys never leave the browser.

## Core Value

Files are stored securely (encrypted client-side) and can be retrieved reliably via Discord's CDN — zero cost, unlimited storage, complete privacy.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Client-side AES-256-GCM encryption — keys never leave browser
- [ ] Unlimited file storage using Discord CDN via webhooks
- [ ] Smart chunking — dynamic 25MB chunks with parallel uploads
- [ ] Virtual scrolling — smooth performance with 10,000+ files
- [ ] Full folder system — create, rename, move, nested folders
- [ ] Drag & drop — intuitive file organization
- [ ] File versioning — keep history of document changes
- [ ] Advanced search — filter by name, type, date
- [ ] In-browser media streaming — preview images, videos, audio
- [ ] Persistent player — continuous playback across navigation
- [ ] Secure sharing — password-protected, time-limited links
- [ ] Photo timeline — Google Photos-style gallery view
- [ ] Discord-inspired dark theme, fully responsive
- [ ] WCAG AA compliant, keyboard navigable
- [ ] PWA ready — installable as native app on mobile/desktop
- [ ] Integration tests with mocked Discord API
- [ ] Self-hosted deployment (static files — no backend server)
- [ ] Environment-based Discord webhook configuration

### Out of Scope

- Server-side storage/sync — Core design is client-side only
- Multi-user collaboration — Single-user storage tool
- Mobile native apps — PWA covers mobile use case
- Video transcoding — Browser cannot transcode; stream as-is
- Real-time file sync — No server for push notifications

## Context

- Previous codebase archived to `archive-v1` branch — this is a greenfield rebuild
- Discord webhooks allow sending files up to 25MB per message
- Discord CDN serves files but URLs may have expiration
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
| Discord webhooks as storage backend | Free, unlimited CDN, no server needed | — Pending |
| Client-side encryption (AES-256-GCM) | Privacy — keys never leave browser | — Pending |
| Self-hosted deployment | User control, no third-party trust | — Pending |
| Coarse granularity for phases | Feature set is comprehensive, fewer broader phases | — Pending |

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
*Last updated: 2026-06-03 after initialization*
