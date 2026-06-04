# Phase 1: Core Storage Engine - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Stateless backend APIs containing file upload chunking, Discord webhook posting, rate limiting handling, download reassembly, and dynamic Discord CDN URL refreshing on failure.

</domain>

<decisions>
## Implementation Decisions

### Backend Framework Selection
- **D-01:** **Fastify** will be used as the backend framework to ensure high performance, native schema validation, and elegant async route handling.

### Discord Client Layer
- **D-02:** **`@discordjs/rest`** will be used to interact with the Discord API. This library handles rate limiting and route queueing internally, avoiding complex custom throttling code.

### Upload Concurrency & Throttling
- **D-03:** Chunks will be uploaded concurrently (concurrency limit = 3) to improve upload speeds, relying on `@discordjs/rest`'s built-in queueing mechanism to throttle requests and respect rate limits.

### JWT Authentication Scheme
- **D-04:** Stateless authentication will use **HS256 signed JWTs** containing the user's plaintext webhook URL in the payload. The backend will verify the token using a server-side secret and extract the webhook URL dynamically. The unique user account identifier (`accountId`) is derived by taking the SHA-256 hash of the webhook URL.

### the agent's Discretion
- Standard choices regarding routing structure, chunk indexing structure in memory/transit, and error response structures are left to the agent's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/PROJECT.md` — Core value proposition, constraints, and architecture.
- `.planning/REQUIREMENTS.md` — Functional specifications and traceability.

### Reference Implementations
- `references/DisboxApp-web/src/disbox-file-manager.js` — Demonstrates message fetching (`getMessage`) to retrieve fresh CDN URLs.
- `references/ddrive/src/DFs/index.js` — Demonstrates chunking size (`DEFAULT_CHUNK_SIZE = 25165824`) and streaming.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (Greenfield project setup).

### Established Patterns
- None (First development phase).

### Integration Points
- This is the initial phase establishing the backend API; all later phases (Virtual Filesystem, React UI) will integrate with this API.

</code_context>

<specifics>
## Specific Ideas

- The dynamic URL refresh mechanism will catch 403/404 CDN download failures and issue a `GET /webhooks/{webhookId}/{webhookToken}/messages/{messageId}` call to fetch the updated message object. The frontend/downloader will then try the refreshed attachment URL.
- File chunking size is capped at 24MB to leave a 1MB margin under Discord's 25MB attachment limit.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Core Storage Engine*
*Context gathered: 2026-06-04*
