# Phase 8: Performance Core — Summary

**Completed:** 2026-06-05
**Mode:** Auto-executed (autonomous pilot)

## Delivered

### Backend
- `src/services/upload-session.ts` — in-memory `Map` session manager with SHA-256 idempotency cache, 24 h TTL, per-account rate-limit tracking, `sweepExpired()`.
- `src/routes/upload-resumable.ts` — 5 endpoints (POST create, HEAD offset, PATCH append, POST finalize, POST cancel) + GET/DELETE; per-account rate limit enforced; `@fastify/multipart` 10 GB cap.
- `src/app.ts` — registered `uploadResumableRoutes` under `/api/upload/session`.
- `tests/upload-session.test.ts` — 10 tests covering session creation, chunk append + idempotency, finalize, cancel, TTL sweep, rate-limit tracking. **10/10 pass.**

### Frontend
- `web/src/api/uploadResumable.ts` — client API (5 helpers), `RateLimitedError`, FNV-1a `chunkIdempotencyKey`, `extractRateLimitInfo`.
- `web/src/hooks/useResumableUploader.ts` — 24 MiB chunks, 4 parallel, exponential backoff (2 s base / 30 s cap, 6 attempts), rate-limit-aware, abort controller, `useUploadsStore` integration.
- `web/src/hooks/useUploader.ts` — branched on `file.size >= 50 MB`; small files keep v1.0 single-POST; big files use `useResumableUploader`. Audit metadata now includes `mode: 'single' | 'resumable'`.
- `web/src/components/VirtualFileList.tsx` — spacer-div virtual list, 40 px rows, `ResizeObserver`-driven viewport, 6-row overscan, no `react-window`.
- `web/src/components/FileList.tsx` — renders `VirtualFileList` when `nodes.length > 100`; otherwise renders directly with hover-prefetch `onMouseEnter`.
- `web/src/hooks/useFolderPrefetch.ts` — 200 ms debounce, last-id short-circuit, react-query `prefetchQuery`.
- `web/tests/setup.ts` — added `ResizeObserver` polyfill (jsdom lacks it).
- `web/tests/components/VirtualFileList.test.tsx` — 5 tests.
- `web/tests/hooks/useFolderPrefetch.test.tsx` — 3 tests.

## Verification

- Backend: `npx vitest run` → 56/56 pass.
- Frontend: `cd web && npm test` → 50/50 pass (was 42).
- `cd web && npx tsc -b` → no errors.
- `cd web && npm run build` → clean, no dynamic-import warning, 253.91 kB JS / 25.16 kB CSS.

## Caveats / known gaps

- In-memory session state — server restart loses resumable state (clients re-create via 404 path; same behavior as fresh session).
- No `react-window` / `react-virtual` — hand-rolled spacer-div. Sufficient for 10k rows; further optimization deferred to v3.1.
- Resumable rate limit defaults to 10 chunks/s per account; configurable via env in v3.1.
- `useUploader` still uses `runWithConcurrency(tasks, 3)` for parallel files; resumable mode within a file is `parallel: 4` chunks. So max in-flight = 3 files × 4 chunks = 12 chunks. Acceptable for the design.
- No end-to-end test of the full upload flow (mocked `appendChunk` etc.); the unit tests cover the protocol shape and the hook's branch logic.
- TUS 1.0.0 protocol surface is a subset; clients must use our specific headers. Full TUS compatibility deferred to v3.1.
