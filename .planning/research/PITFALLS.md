# Pitfalls Research: Wyvern Drive

> Browser-based cloud storage using Discord webhooks as backend with client-side encryption.
> Self-hosted, client-only web app. No backend server.

---

## Discord API Pitfalls

### Webhook Rate Limits
**Risk:** Uploading file chunks via webhook triggers rate limiting. Discord enforces per-route limits (typically 5 requests per 5 seconds per webhook) and a global limit of 50 requests/sec. Exceeding these returns HTTP 429 with `Retry-After` header. Burst uploads of large files (many chunks) will hit these limits immediately.

**Warning signs:**
- HTTP 429 responses during chunk uploads
- `X-RateLimit-Remaining: 0` in response headers
- `X-RateLimit-Global: true` in 429 responses (entire bot/IP locked out)

**Prevention:**
- Parse `X-RateLimit-*` response headers on every request
- Implement exponential backoff on 429 responses using `retry_after` field
- Serialize uploads per webhook (max 5 concurrent)
- Use `wait=true` query param to get message confirmation before next upload
- Track rate limit buckets via `X-RateLimit-Bucket` header

**Phase:** Phase 2 (Core Upload Engine)

### CDN URL Expiration
**Risk:** Discord attachment CDN URLs are signed and expire. The `ex` parameter in the URL is a hex timestamp indicating expiry. If users bookmark or share URLs, they break. The `hm` parameter is a signature valid until expiry. Discord auto-refreshes URLs in its own client, but Wyvern Drive stores raw URLs in IndexedDB — these will go stale.

**Warning signs:**
- URLs in metadata stop working after hours/days
- Users report "file not found" on previously working files
- 403/410 errors when fetching stored CDN URLs

**Prevention:**
- Store message IDs alongside CDN URLs (can re-fetch message to get fresh URL)
- Implement URL refresh logic: fetch message via webhook API to get updated attachment URL
- Cache URLs with TTL shorter than expiry
- Display "URL may have expired" warnings on old files
- Consider storing the webhook message ID as the source of truth, not the URL

**Phase:** Phase 2 (Core Upload Engine)

### File Size Limits
**Risk:** Default upload limit is 10MB per file per request. Nitro/Boost can increase this, but Wyvern Drive should assume the minimum. Files larger than the limit silently fail or return 400 errors. Each chunk must fit within this limit.

**Warning signs:**
- 400 Bad Request on larger chunks
- Users with free accounts unable to upload
- Chunk size hardcoded above 10MB

**Prevention:**
- Default chunk size: 8MB (leaves room for multipart overhead + metadata)
- Detect user's upload limit via attachment_size_limit from interactions
- Dynamic chunk sizing: reduce on 400 errors
- Show clear error when individual chunk exceeds limit

**Phase:** Phase 2 (Core Upload Engine)

### Webhook Deletion
**Risk:** Deleting a webhook is permanent and doesn't delete the messages/files already sent. However, orphaned webhook messages become inaccessible via the webhook token. Files remain on Discord CDN until Discord's retention policy removes them (typically weeks/months, but not guaranteed). The webhook channel can also be deleted by server admins, severing access to message IDs.

**Warning signs:**
- Users report files vanish after server admin cleans webhooks
- Channel deletion makes message IDs unreachable
- No way to verify webhook still exists without making API calls

**Prevention:**
- Store multiple fallback webhook URLs (different channels/servers)
- Never assume webhook permanence — validate before operations
- Warn users that deleting Discord channels/webhooks will lose file access
- Implement webhook health checks on app startup
- Store webhook ID + token + channel ID for recreation capability

**Phase:** Phase 1 (Foundation)

### API Versioning & Deprecation
**Risk:** Discord API versions are deprecated and eventually discontinued. Currently v6 is default but deprecated; v10 is latest available. Using a deprecated version returns warnings; discontinued versions return 400. Breaking changes in new versions can affect file handling, message objects, and attachment structures.

**Warning signs:**
- Deprecation headers in responses
- Sudden 400 errors after Discord updates API
- Changed attachment object structure

**Prevention:**
- Pin to a specific API version (v10) in all URLs: `https://discord.com/api/v10/...`
- Monitor Discord changelog: https://discord.com/developers/change-log
- Abstract all Discord API calls behind a service layer
- Never hardcode API version in multiple places

**Phase:** Phase 1 (Foundation)

### Invalid Request Cloudflare Bans
**Risk:** IP addresses making too many invalid requests (401, 403, 429) are temporarily banned from the Discord API. Limit is 10,000 invalid requests per 10 minutes. A misconfigured webhook token or broken code loop can trigger this quickly, locking out all operations.

**Warning signs:**
- Repeated 403 Cloudflare errors
- All webhook operations fail simultaneously
- Errors occur on startup (likely bad credentials)

**Prevention:**
- Stop all requests immediately on repeated auth failures
- Never retry 401/403 errors (unlike 429)
- Cache and validate webhook tokens before bulk operations
- Implement circuit breaker pattern for API calls
- Log invalid request rate to detect problems early

**Phase:** Phase 2 (Core Upload Engine)

---

## Client-Side Encryption Pitfalls

### Nonce/IV Reuse in AES-GCM
**Risk:** AES-GCM requires a unique nonce (initialization vector) for every encryption operation with the same key. Reusing a nonce completely breaks authentication and can leak plaintext. With millions of chunks encrypted under the same derived key, nonce management is critical. A collision means an attacker can forge ciphertexts.

**Warning signs:**
- Using counter-based nonces without proper state tracking
- Random nonces with birthday problem at scale (random 96-bit nonce has ~50% collision at ~2^48 encryptions)
- No nonce persistence across sessions
- Nonce stored separately from ciphertext (easy to lose)

**Prevention:**
- Use 96-bit random nonces (NIST recommended) — collision probability negligible for reasonable file counts
- Prepend nonce to every encrypted chunk (12 bytes overhead)
- Store nonce in IndexedDB alongside chunk metadata
- Never reuse derived keys across files (derive per-file keys)
- Consider XChaCha20-Poly1305 for larger nonce space if paranoid

**Phase:** Phase 1 (Foundation)

### Key Derivation Weakness
**Risk:** Using PBKDF2 with too few iterations makes the key derivation factorable. Default PBKDF2 iterations in many libraries are too low. If user's password is weak, offline brute-force is trivial. Storing salt improperly (e.g., in localStorage) weakens the scheme.

**Warning signs:**
- PBKDF2 iterations < 100,000
- Salt stored in same storage as encrypted data without protection
- No key stretching mechanism
- Same salt for multiple users

**Prevention:**
- PBKDF2 with ≥600,000 iterations (OWASP 2024 recommendation) or Argon2id
- Generate unique 128-bit salt per user, store in IndexedDB
- Salt is not secret — its purpose is preventing rainbow tables
- Derive separate keys for encryption and authentication via HKDF
- Show key derivation time to user as security indicator

**Phase:** Phase 1 (Foundation)

### Key Recovery / Browser Data Loss
**Risk:** If user clears browser data (cookies, IndexedDB), all metadata and encrypted keys are lost. Without the derived key (from password), files on Discord CDN are irrecoverable. This is the #1 user-facing data loss scenario. No "forgot password" mechanism exists — that's the point of E2E encryption.

**Warning signs:**
- No export/import mechanism for keys
- Users unaware that clearing browser data = data loss
- No warning prompts before destructive browser actions
- Single point of failure for key material

**Prevention:**
- Implement key export to encrypted file (.wdkey)
- Support key import on new devices
- Show persistent warning: "Clearing browser data will lose access to all files"
- Store master key derivation parameters (salt, iterations) in exportable metadata
- Consider BIP39-style recovery phrase for master password

**Phase:** Phase 1 (Foundation)

### Encryption Performance on Large Files
**Risk:** AES-GCM encryption of large files (100MB+) blocks the main thread, causing UI freezes. Web Crypto API is async but still single-threaded per context. Multiple parallel encryptions compete for CPU time. Mobile devices have significantly slower crypto performance.

**Warning signs:**
- UI freezes during file upload
- Chrome "page unresponsive" dialogs
- Memory usage spikes during encryption
- Slow encryption on mobile devices

**Prevention:**
- Encrypt in Web Workers (Web Crypto API available in workers)
- Stream-encrypt chunks: read chunk → encrypt → send → next chunk
- Never load entire file into memory
- Use `Blob.slice()` for chunked reading (streaming API)
- Show per-chunk progress, not per-file
- Limit concurrent encryption operations to 2-3 on mobile

**Phase:** Phase 2 (Core Upload Engine)

### Browser Compatibility (Web Crypto API)
**Risk:** Web Crypto API requires secure context (HTTPS). Running on `localhost` works, but HTTP deployments fail silently. Some older browsers lack full AES-GCM support. Safari had intermittent bugs with large crypto operations. `SubtleCrypto` naming confuses developers — methods are on `crypto.subtle`, not `crypto`.

**Warning signs:**
- `crypto.subtle is undefined` errors on HTTP
- Encryption silently fails on older browsers
- Safari-specific crypto bugs
- Mixed content warnings blocking crypto operations

**Prevention:**
- Require HTTPS (or localhost) — show clear error otherwise
- Feature-detect `window.crypto?.subtle` on startup
- Provide fallback messaging for unsupported browsers
- Test on Safari, Chrome, Firefox, Edge explicitly
- Use `isSecureContext` property for detection

**Phase:** Phase 0 (Architecture)

---

## Browser Storage Pitfalls

### IndexedDB Storage Quotas & Eviction
**Risk:** Browsers impose storage quotas that vary by browser and available disk space. Chrome uses ~60% of free disk space, Firefox uses ~50%, Safari caps at ~1GB for non-ITP contexts. When quota is exceeded, IndexedDB operations fail silently or throw `QuotaExceededError`. Browsers may evict data without warning during storage pressure.

**Warning signs:**
- `QuotaExceededError` during metadata writes
- Files disappear after OS disk fills up
- Safari users report data loss after days
- No storage usage monitoring

**Prevention:**
- Query `navigator.storage.estimate()` for usage/quota on startup
- Warn user at 80% quota usage
- Implement storage cleanup for temporary data (cache, previews)
- Never store actual file data in IndexedDB — only metadata
- Test with `navigator.storage.persist()` for critical data
- Handle `QuotaExceededError` gracefully in all write paths

**Phase:** Phase 1 (Foundation)

### Metadata Scale (10K+ Files)
**Risk:** With 10,000+ files, each with versions, chunks, and tags, metadata grows large. IndexedDB cursor iteration becomes slow at scale. Loading all metadata on startup causes multi-second delays. Compound queries (file + version + chunks) require multiple indexed lookups.

**Warning signs:**
- App startup takes >3 seconds with large file counts
- Cursor-based listing becomes sluggish
- Memory usage grows with file count
- Search/filter operations become slow

**Prevention:**
- Lazy-load metadata (paginated queries, not cursors over everything)
- Use compound indexes for common query patterns (parentId + name)
- Implement virtual scrolling for file lists
- Cache frequently-accessed metadata in memory
- Consider IndexedDB wrappers (Dexie.js) for optimized queries
- Separate hot metadata (recent files) from cold (archived)

**Phase:** Phase 3 (UI Polish)

### IndexedDB Transaction Management
**Risk:** IndexedDB transactions auto-commit when the event loop returns without pending requests. Transactions tied to DOM events may complete before async operations finish. Opening too many transactions simultaneously degrades performance. Readwrite transactions on the same store are serialized — parallel writes queue up.

**Warning signs:**
- `TRANSACTION_INACTIVE_ERR` errors
- Data not persisting after write operations
- Slow writes when many operations happen simultaneously
- Transactions completing before async handlers finish

**Prevention:**
- Keep transactions alive by chaining requests
- Use readwrite transactions only when necessary
- Batch related writes into single transactions
- Never create transactions in unload/beforeunload handlers
- Use `db.onversionchange` to handle multi-tab conflicts
- Wrap IndexedDB operations in Promise-based abstractions

**Phase:** Phase 1 (Foundation)

### Cross-Origin & Privacy Mode Restrictions
**Risk:** IndexedDB is same-origin bound. Deploying to a different origin (subdomain, port) creates a new empty database. Browser privacy modes may restrict IndexedDB access entirely. Third-party cookie blocking affects iframe-based IndexedDB access. Users may have third-party storage disabled.

**Warning signs:**
- Fresh database on each deployment (origin change)
- Data unavailable in incognito/private windows
- iframe-embedded app can't access IndexedDB
- `SecurityError` on database open

**Prevention:**
- Deploy to a stable origin (same domain/port always)
- Detect privacy mode and warn users (storage may be ephemeral)
- Don't embed in iframes — run as top-level page
- Handle `SecurityError` on database open gracefully
- Consider fallback to OPFS for larger storage needs

**Phase:** Phase 0 (Architecture)

---

## Chunking & Upload Pitfalls

### Parallel Upload Ordering
**Risk:** Chunks uploaded in parallel arrive at Discord in unpredictable order. Reassembly requires tracking chunk indices. If chunk 5 arrives before chunk 1, file corruption occurs without proper ordering metadata. Discord message IDs don't correlate with upload order.

**Warning signs:**
- Reassembled files are corrupted
- Chunk order in Discord channel doesn't match upload order
- File downloads fail or produce garbage data

**Prevention:**
- Store chunk index in filename: `file_v1_chunk_003.bin`
- Store chunk order in IndexedDB metadata (array of message IDs in order)
- Use deterministic naming: `{fileId}_v{version}_c{chunkIndex}`
- Never rely on Discord message order for reassembly
- Verify reassembly by checking total chunks against expected count

**Phase:** Phase 2 (Core Upload Engine)

### Failed Chunk Recovery
**Risk:** If one chunk fails to upload (network error, rate limit), the entire file becomes unrecoverable. Partial uploads leave orphaned chunks on Discord with no reference. Retrying failed chunks without idempotency can create duplicates.

**Warning signs:**
- Files show as "uploading" indefinitely
- Partial chunk counts in Discord vs metadata
- Duplicate chunks appearing on retry

**Prevention:**
- Track per-chunk upload status: pending, uploading, complete, failed
- Implement chunk-level retry (not whole-file retry)
- Delete orphaned chunks on failure (webhook message deletion)
- Use idempotent filenames (same filename = same content hash)
- Show chunk-level progress: "3/7 chunks uploaded"
- Support resume from last successful chunk

**Phase:** Phase 2 (Core Upload Engine)

### Memory Pressure During Chunking
**Risk:** Reading an entire file into memory for chunking causes OOM on large files. Creating Blob views for each chunk without proper cleanup leaks memory. Parallel encryption + upload doubles memory usage. Mobile browsers have stricter memory limits (~500MB-1GB for tabs).

**Warning signs:**
- Tab crashes on large file uploads (>500MB)
- Memory usage grows linearly with file size
- Mobile uploads fail silently
- Browser kills tab to free memory

**Prevention:**
- Use `File.slice()` to read chunks lazily (never load full file)
- Process one chunk at a time: read → encrypt → upload → release
- Limit concurrent uploads to 2-3
- Use ReadableStream where supported for true streaming
- Monitor memory via `performance.memory` (Chrome only) and throttle
- Set hard limit: warn on files >2GB, block on files >5GB

**Phase:** Phase 2 (Core Upload Engine)

### Progress Tracking Across Parallel Uploads
**Risk:** No native mechanism to aggregate progress across parallel chunk uploads. Each fetch() call has its own progress, but combining them into a unified progress bar is non-trivial. Users see jumpy or inaccurate progress indicators.

**Warning signs:**
- Progress bar jumps backward
- Progress stuck at 99% while last chunk uploads
- No indication of which chunk is uploading

**Prevention:**
- Track progress per-chunk (loaded/total per request)
- Aggregate: totalProgress = sum(chunkProgress) / totalChunks
- Use XMLHttpRequest instead of fetch() for upload progress events
- Show both file-level and chunk-level progress
- Display current chunk number and speed

**Phase:** Phase 3 (UI Polish)

---

## PWA Pitfalls

### Service Worker Caching for Storage App
**Risk:** Service workers cache app shell (HTML/CSS/JS) but caching file content defeats the purpose of Discord as storage. Stale cached files create confusion. Service workers may intercept fetch requests to Discord CDN, breaking downloads. Cache storage has its own quotas separate from IndexedDB.

**Warning signs:**
- Old version of app served from cache
- File downloads served from cache instead of Discord
- Cache storage filling up with file content
- Service worker serving stale data

**Prevention:**
- Cache only app shell (HTML, CSS, JS, icons) — never file content
- Use network-first strategy for Discord API calls
- Implement cache versioning with automatic cleanup
- Add "Clear Cache" option in settings
- Use `stale-while-revalidate` for static assets only

**Phase:** Phase 4 (PWA & Offline)

### Cache Invalidation
**Risk:** Deploying new versions while users have old service workers cached. Stale app shell serves old code that may be incompatible with current IndexedDB schema. Users see broken UI after update. No automatic update mechanism for service workers.

**Warning signs:**
- Users report broken UI after deploy
- Console shows schema version mismatch errors
- Service worker update never activates

**Prevention:**
- Use `skipWaiting()` and `clients.claim()` for immediate activation
- Implement IndexedDB schema versioning with migration support
- Show "Update available" prompt with reload option
- Cache-bust static assets with content hashes
- Test service worker lifecycle: install → activate → fetch

**Phase:** Phase 4 (PWA & Offline)

### iOS PWA Limitations
**Risk:** iOS Safari has severe PWA limitations: no push notifications, limited storage (~50MB for service workers, ~1GB for IndexedDB but may be evicted), no background sync, no WebSocket in service workers, service workers killed after 30 seconds of inactivity. Add to Home Screen prompt is hidden and unreliable.

**Warning signs:**
- iOS users report data loss after几天
- Service worker stops working after app backgrounded
- Storage quotas much lower than desktop
- No notification support on iOS

**Prevention:**
- Test extensively on iOS Safari
- Don't rely on background sync — complete uploads before background
- Implement frequent auto-save of state
- Warn iOS users about storage limitations
- Consider iOS-specific storage strategy (smaller metadata footprint)
- Accept that iOS experience will be degraded vs desktop

**Phase:** Phase 4 (PWA & Offline)

---

## UI/UX Pitfalls

### Virtual Scrolling with Variable-Height Items
**Risk:** File lists with nested folders, file previews, and metadata have variable row heights. Standard virtual scrolling assumes fixed heights. Miscalculated heights cause items to overlap, disappear, or leave gaps. Resizing the window breaks height calculations.

**Warning signs:**
- Items overlap when scrolling fast
- Blank gaps appear in file list
- Scroll position jumps after resizing
- Performance degrades with 1000+ visible items

**Prevention:**
- Use dynamic-height virtual scrolling (e.g., TanStack Virtual)
- Measure actual heights after render, cache them
- Recalculate on resize with debounce
- Use `content-visibility: auto` for off-screen items
- Limit visible items to viewport + buffer zone

**Phase:** Phase 3 (UI Polish)

### Drag & Drop Across Nested Folders
**Risk:** HTML5 drag and drop API is notoriously buggy. Cross-folder moves require tracking source/destination paths. Drop targets in nested trees are hard to calculate. Mobile has no native drag & drop. Drop events may fire multiple times or not at all.

**Warning signs:**
- Drop targets highlight incorrectly in nested trees
- Files "disappear" after drag operation
- Drop event fires multiple times
- No drag support on mobile/touch devices

**Prevention:**
- Use a battle-tested DnD library (dnd-kit, react-beautiful-dnd)
- Implement optimistic updates (move file immediately, rollback on error)
- Support touch devices with long-press + context menu
- Validate move operations before executing (prevent circular references)
- Show drop target highlight with clear visual feedback

**Phase:** Phase 3 (UI Polish)

### Media Streaming from Remote URLs (CORS)
**Risk:** Discord CDN does not send CORS headers for attachment URLs. Direct `<video>` or `<audio>` elements pointing to Discord CDN will fail due to CORS policy. Image loading works but cross-origin canvas operations (thumbnails, previews) are tainted. No range request support means no seeking in video.

**Warning signs:**
- `<video>` elements show black screen
- Canvas operations throw `SecurityError` on Discord images
- Video seeking doesn't work
- "No 'Access-Control-Allow-Origin' header" errors

**Prevention:**
- Proxy media through a CORS-friendly endpoint (or use service worker)
- For images: use `<img>` tags (no CORS needed for display)
- For video: download then play locally, or use proxy
- Implement thumbnail generation in Web Worker with CORS-safe methods
- Consider using Discord's embed URLs for images (have CORS)

**Phase:** Phase 3 (UI Polish)

### Accessibility in Complex UI
**Risk:** File trees, drag-and-drop, virtual scrolling, and nested navigation are notoriously hard to make accessible. Screen readers can't navigate virtual lists. Keyboard users can't perform drag operations. Color-only indicators fail for colorblind users.

**Warning signs:**
- No keyboard navigation in file tree
- Screen readers announce "blank" for virtual list items
- Drag operations inaccessible to keyboard users
- No ARIA labels on interactive elements

**Prevention:**
- Implement ARIA tree pattern for file navigation
- Support full keyboard navigation (arrow keys, Enter, Delete)
- Provide alternative actions for drag (cut/paste menu)
- Use `aria-live` regions for upload progress
- Test with NVDA, VoiceOver, and keyboard-only navigation
- Follow WCAG 2.2 AA guidelines

**Phase:** Phase 3 (UI Polish)

---

## Top 5 Critical Risks

1. **Nonce/IV Reuse in AES-GCM** — Reusing a nonce under the same key completely breaks encryption authentication. At scale with millions of chunks, this is catastrophic. **Prevention:** Per-file key derivation, random 96-bit nonces prepended to every chunk, never reuse keys across files.

2. **CDN URL Expiration Without Refresh** — Discord attachment URLs expire silently. Without a refresh mechanism, all stored file references become dead links. **Prevention:** Store webhook message IDs (not just URLs), implement URL refresh by re-fetching messages, display staleness warnings.

3. **Browser Data Loss = Total Data Loss** — Clearing browser data destroys all metadata and key material. Without recovery mechanism, encrypted files on Discord become permanently inaccessible. **Prevention:** Key export/import to encrypted files, clear warnings to users, recovery phrase for master password.

4. **IndexedDB Quota Exhaustion** — With 10K+ files, metadata grows large. Browsers enforce quotas (especially Safari's ~1GB cap). Unhandled `QuotaExceededError` corrupts the metadata store. **Prevention:** Monitor storage usage, implement cleanup, warn at 80% quota, never store file data in IndexedDB.

5. **Chunk Upload Failure Cascade** — One failed chunk in a parallel upload can corrupt the entire file. Without per-chunk tracking and retry, partial uploads create orphaned Discord messages with no recovery path. **Prevention:** Track chunk status individually, implement chunk-level retry with idempotent naming, show chunk-level progress, support resume.
