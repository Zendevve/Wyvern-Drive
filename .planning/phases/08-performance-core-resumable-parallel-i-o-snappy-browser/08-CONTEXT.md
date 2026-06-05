# Phase 8: Performance Core (resumable parallel I/O + snappy browser) — Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — ROADMAP phase goal is the spec)

<domain>
## Phase Boundary

Uploading a 1 GB file survives browser refresh, tab close, and network drops; the directory browser stays at 60 fps with 10,000+ items; folder navigation feels instant.

This phase delivers the single biggest UX win of v3.0: the upload pipeline stops being the bottleneck. The directory browser becomes responsive at scale. Folder navigation stops being blocked on the network.

Out of scope (later phases): end-to-end encryption (Phase 9), persistent crash-surviving operation queue (Phase 10), disaster recovery export/import (Phase 11), observability dashboard (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Locked (from ROADMAP.md)

- **PERF-01**: Resumable uploads for files >50 MB.
- **PERF-02**: Parallel chunk uploads with bounded concurrency (default 4, user-configurable 1–8). Rate-limit aware: parses `X-RateLimit-Remaining` and `X-RateLimit-Reset-After`; auto-throttles on 429.
- **PERF-03**: Virtual scrolling for the directory browser. Smooth 60fps with 10,000+ items.
- **PERF-04**: Background prefetch on folder hover with 200 ms debounce.
- Per-chunk idempotency keys (SHA-256 of `fileId:chunkIndex`). Same chunk retried after network drop does not create duplicate Discord messages.
- Adaptive chunk sizing: 8 / 16 / 24 MiB based on bandwidth probe.

### the agent's Discretion

- **Protocol**: Implement a focused subset of TUS.io protocol — endpoints shaped like TUS (`POST /upload/session`, `HEAD /upload/session/:id`, `PATCH /upload/session/:id`, `POST /upload/session/:id/finalize`) but NOT claiming strict TUS 1.0.0 compliance. Rationale: full TUS requires supporting all extensions (creation, expiration, concatenation, checksum, creation-defer-length); for v3.0 we want the *capability* (resumable, parallel, idempotent) without the protocol-spec surface area. Documented in PLAN.md as a deviation.
- **Session state**: in-memory `Map<sessionId, UploadSession>` in the Fastify process. Lost on server restart; session is re-creatable from the client (client sends a request to resume by session id; server returns 404 if gone, client starts a new session). Disk persistence of session state is a v3.1 concern.
- **Client library**: Do NOT add `tus-js-client`. Write a small `useResumableUploader` hook that drives the 4 endpoints directly with `fetch()` and `XMLHttpRequest` (XHR for upload progress). Tighter control, no new dep, ~200 lines.
- **Virtual scrolling**: Vanilla implementation in a `VirtualList` component, no `react-window` dep. ~100 lines. Spacer-div pattern with absolute-positioned rows. Handles 10k items trivially.
- **Chunk size selection**: 24 MiB default (matches v1.0 server `CHUNK_SIZE` constant — `24 * 1024 * 1024`). Bandwidth-probe-based selection (8/16/24) is nice-to-have but adds complexity; defer to v3.1.
- **Threshold**: PERF-01 only applies to files >50 MB. Files ≤50 MB use the existing v1.0 single-POST upload (faster, no protocol overhead).
- **Rate-limit response**: Server returns `429` with `Retry-After` header on Discord rate limit. Client backs off for `Retry-After` seconds before retry. The Discord API also surfaces `X-RateLimit-Remaining` and `X-RateLimit-Reset-After` — the client surfaces these in the UI (OPS-03 will own the dashboard; for now, log + audit only).
- **Idempotency key**: SHA-256 of `sessionId:offset` (deterministic; same offset on retry = same key). Server caches `(key → result)` in the session; re-submitting the same PATCH returns the cached 200 response without re-uploading to Discord.
- **Audit integration**: Upload lifecycle events already wrapped in `withAudit` from Phase 7. Resume events get a new `outcome: 'success'` audit entry with metadata `{ phase: 'resumed', offset, total_size }`. Cancellation events already wired.

</decisions>

<code_context>
## Existing Code Insights

- v1.0 server has a single `POST /upload` route (`src/routes/upload.ts`) that chunks server-side at 24 MiB and pushes to Discord. Resumable support requires *client* chunking because the server doesn't know chunk boundaries until it sees them.
- v1.0 client `useUploader` (`web/src/hooks/useUploader.ts`) does a single `POST /upload` via `XMLHttpRequest`. The v1.0 client doesn't know how many chunks will result; the server decides. Resumable requires the *client* to decide chunk boundaries (so it knows what offset to resume from).
- `useUploader` already calls `runWithConcurrency(tasks, 3, ...)` for parallel files; the new version needs in-file parallel chunk uploads (different concurrency domain).
- The `audit` infrastructure (Phase 7) wraps uploads with `withAudit`, so any new upload code path can compose with existing audit events.
- Existing `FileList` component (`web/src/components/FileList.tsx`, 1.8 KB) renders the directory browser. It will be wrapped or replaced by a `VirtualFileList` for folders with >N items.

</code_context>

<specifics>
## Specific Ideas

None — discuss phase skipped. Use ROADMAP phase goal and success criteria as the spec.

</specifics>

<deferred>
## Deferred Ideas

- Full TUS 1.0.0 protocol compliance with all extensions — defer to v3.1 (or never, if our custom protocol works).
- Disk persistence of upload session state across server restarts — defer to v3.1.
- Adaptive chunk sizing based on bandwidth probe — defer to v3.1 (24 MiB constant is fine for v1).
- File deduplication (content-addressed chunks) — defer to v4.
- Drag-and-drop reordering of in-flight uploads — defer to F-16 (v3.1).
- Connection-health dashboard UI — OPS-03 in Phase 12 owns this; Phase 8 just emits the data.

</deferred>
