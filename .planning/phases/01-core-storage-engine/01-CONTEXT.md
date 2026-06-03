# Phase 1: Core Storage Engine - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a working end-to-end encrypted file storage pipeline. Users can configure a Discord webhook, upload any file size (encrypted client-side with AES-256-GCM), and download/decrypt files. The entire storage pipeline works: encrypt → chunk → upload via Discord webhooks → store metadata in IndexedDB → fetch from CDN → decrypt → reassemble.

</domain>

<decisions>
## Implementation Decisions

### Encryption Key Management
- Password entered via modal on first use — locks app until password entered
- Derived key cached in memory for the session with auto-lock after 15 minutes inactivity
- Browser refresh re-prompts for password (key not persisted)
- Password strength indicator with estimated crack time (OWASP zxcvbn)

### Webhook Configuration
- Webhook URL configured via Settings UI with localStorage persistence
- App validates webhook on save by sending test message and confirming 204/200
- Single webhook for v1 (simpler implementation)
- Webhook token stored in IndexedDB — needed for CDN URL refresh via message fetch

### Upload UX
- Both drag-and-drop zone and file picker button equally prominent
- Progress display per-file with chunk count ("Uploading 3/7 chunks")
- 3 concurrent chunk uploads per file
- Auto-retry 3x with exponential backoff on failure, then show retry button

### Download & Error Handling
- Click filename to download + dedicated download icon button
- Images, audio, video show inline with decrypt-on-load
- Toast notifications for errors (non-blocking, auto-dismiss after 5s)
- CDN URL expired: auto-refresh silently via message fetch, then download

### the agent's Discretion
- All remaining implementation choices at the agent's discretion

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield project — no existing code
- Research documents in `.planning/research/` provide architecture, stack decisions, and pitfalls

### Established Patterns
- Stack: Vite 6 + React 19 + TypeScript + Tailwind CSS v4
- State: Zustand (per research recommendation)
- Metadata: IndexedDB via `idb` library (per research recommendation)
- Crypto: Native Web Crypto API (no dependencies)
- Discord API: v10 pinned, `?wait=true` on webhook execute

### Integration Points
- All new code — no existing integration points

</code_context>

<specifics>
## Specific Ideas

- 8MB default chunk size (conservative, Discord default limit is 10MB)
- PBKDF2 600,000 iterations (OWASP 2023 recommendation)
- Webhook names must avoid `clyde` and `discord` substrings
- Discord API pinned to v10 in all URLs
- Rate limiter: token bucket with exponential backoff on 429
- CDN URL refresh: store messageId, re-fetch via GET /webhooks/{id}/{token}/messages/{message_id}

</specifics>

<deferred>
## Deferred Ideas

- Multiple webhook support (v2 consideration)
- WebDAV protocol support (v2)
- File deduplication (v2)
- Batch operations (v2)

</deferred>
