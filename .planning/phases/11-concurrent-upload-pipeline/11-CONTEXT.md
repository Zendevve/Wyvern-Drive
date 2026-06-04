# Phase 11: Concurrent Upload Pipeline - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the RateLimiter to support true concurrent task execution (default limit of 3) with pre-emptive rate-limit header tracking and millisecond-safe backoff, unlocking parallel chunk uploads that were previously serialized.

</domain>

<decisions>
## Implementation Decisions

### Concurrency & Limit
- **D-01:** `RateLimiter` supports concurrent task execution up to a configurable `concurrencyLimit` (defaults to 3), passed via the constructor.
- **D-02:** Refactor the internal queue processing loop in `RateLimiter` to poll and run up to `concurrencyLimit` tasks in parallel.

### Rate Limiting & Backoff
- **D-03:** Parse `retry_after` from Discord response headers/bodies and ensure it is converted from seconds (possibly float) to milliseconds before sleeping.
- **D-04:** Implement pre-emptive rate-limiting by tracking remaining capacity (`X-RateLimit-Remaining` and `X-RateLimit-Reset-After`/`X-RateLimit-Reset`) per bucket (derived from route or `X-RateLimit-Bucket` header). Pause/delay issuing new requests for that bucket before the capacity reaches 0.

### the agent's Discretion
- **AD-01:** Concurrency Limit: Defaults to 3, constructor-configured, no UI settings screen will be created in this phase.
- **AD-02:** Rate Limiting Scope: Track limits per dynamic bucket using the `X-RateLimit-Bucket` header returned by Discord, falling back to webhook URL path parts if the header is absent.
- **AD-03:** Priority/Queue: Use standard First-In-First-Out (FIFO) queue for task execution.
- **AD-04:** Error Propagation: Fail-fast for multi-chunk file uploads; if a chunk upload fails permanently, cancel or skip subsequent chunks for that file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Specifications
- `.planning/PROJECT.md` — Project snapshots, theme tokens, and non-negotiables.
- `.planning/REQUIREMENTS.md` — Functional and technical requirements.
- `.planning/ROADMAP.md` — Phase goals, constraints, and success criteria.

### Source Files
- `src/lib/rate-limiter.ts` — Existing sequential rate limiter implementation.
- `src/lib/discord.ts` — Discord API calls using the rate limiter.
- `src/lib/upload.ts` — File upload orchestration and concurrent task wrapper.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RateLimiter` in `src/lib/rate-limiter.ts` is the primary focus. It already has basic backoff and sleep utilities.
- `runWithConcurrency` in `src/lib/upload.ts` is a helper function that spawns concurrent tasks.

### Established Patterns
- Tasks are enqueued via `limiter.enqueue(fn)` in `src/lib/discord.ts`.
- Discord rate limits throw a `DiscordRateLimitError`.

### Integration Points
- `src/lib/discord.ts` - All calls to webhook/message APIs go through the single global `limiter` instance.
- `src/lib/upload.ts` - Calls `uploadChunk` which executes under the `limiter`.

</code_context>

<specifics>
## Specific Ideas

- None — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- Settings UI option for customizing concurrency limit — Deferred to a later optimization phase.

</deferred>

---

*Phase: 11-concurrent-upload-pipeline*
*Context gathered: 2026-06-04*
