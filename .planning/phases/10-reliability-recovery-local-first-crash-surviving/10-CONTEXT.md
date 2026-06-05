# Phase 10: Reliability & Recovery (local-first, crash-surviving) - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Every user action is durable: it persists locally first, survives tab crashes, browser restarts, and network outages, and replays automatically when connectivity returns.

</domain>

<decisions>
## Implementation Decisions

### Durable Queue Storage & Queue Worker Behavior
- Dedicated Database (`wyvern-drive-queue` with `operations` store)
- Hybrid approach: `navigator.onLine` events + 15s polling ping to `/api/fs/stats` when offline
- Bounded concurrency of 2 workers
- Exponential backoff (e.g. 1.5s, 3s, 6s, 12s, 24s) capped at 5 retries, then mark `failed`

### Queue UI & User Control
- Global sliding drawer toggled by `Ctrl+Shift+D`
- Allow pausing the queue, viewing logs/errors, manual retry, and deleting operations
- Toast notification on complete; persistent warning toast on failure with "Open Diagnostics" link

### Idempotency & Conflict Resolution
- Discard duplicate operations enqueued with the same `idempotency_key`
- Strict FIFO order execution
- If an operation fails, auto-cancel (`status: cancelled`) any subsequent queued tasks that depend on the same target ID

### the agent's Discretion
None - all decisions have been explicitly accepted during the Smart Discuss phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/lib/audit.ts` — IndexedDB open and transaction patterns
- `web/src/lib/secretStore.ts` — IndexedDB store helpers
- `web/src/hooks/useResumableUploader.ts` — chunked uploader client driving resumable chunk logic

### Established Patterns
- TypeScript strict mode, ESM, Vitest
- IndexedDB for persistence
- Toast notification system (`useToastStore` or similar)

### Integration Points
- `web/src/lib/api.ts` — `apiFetch` calls should be intercepted or go through `enqueue()` for mutating operations
- `web/src/App.tsx` — mount diagnostics panel keyboard listener and render overlay
- `web/src/hooks/useUploader.ts` — integrate with OperationQueue

</code_context>

<specifics>
## Specific Ideas

No specific requirements - open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
