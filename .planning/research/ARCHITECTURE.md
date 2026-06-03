# Architecture Research: Wyvern Drive

## Overall Architecture

Wyvern Drive is a **client-only PWA** — no backend server exists. The browser handles all logic: encryption, chunking, upload orchestration, metadata management, and UI rendering. Discord webhooks and CDN serve as the remote storage layer.

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (PWA)                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  UI Layer │  │  State   │  │  IndexedDB Metadata   │ │
│  │  (React)  │←→│  (Zustand)│←→│  (files, folders,     │ │
│  │          │  │          │  │   versions, nonces)    │ │
│  └──────────┘  └──────────┘  └───────────────────────┘ │
│       ↕              ↕              ↕                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Core Services Layer                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │  │
│  │  │ Encrypt  │  │  Chunker │  │  Discord API   │  │  │
│  │  │ Service  │  │  Service │  │  Client        │  │  │
│  │  │ (Worker) │  │          │  │  (Webhooks+CDN)│  │  │
│  │  └──────────┘  └──────────┘  └────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         ↕                                    ↕
    Discord Webhooks API              Discord CDN
    (POST multipart/form-data)       (GET signed URLs)
```

**Key design principle**: Every component communicates through a central service layer. UI never directly touches Discord APIs or encryption. The state manager (Zustand) orchestrates all operations.

## Data Flow

### Upload Flow

```
User selects file(s) via drag-and-drop or file picker
    │
    ▼
1. Create file record in IndexedDB (status: "uploading")
    │
    ▼
2. Read file as ArrayBuffer (streaming for large files)
    │
    ▼
3. Derive AES-256-GCM key from password (PBKDF2, Web Worker)
    │   - 600,000 iterations (OWASP 2023 recommendation)
    │   - Salt stored in IndexedDB per-file
    │
    ▼
4. Encrypt entire file with AES-256-GCM (Web Worker)
    │   - Generate random 12-byte IV (nonce)
    │   - Nonce stored in IndexedDB
    │   - Output: ciphertext + auth tag
    │
    ▼
5. Split encrypted blob into chunks (max 25MB each)
    │   - Small files (<25MB) = 1 chunk
    │   - Large files = N chunks
    │   - Each chunk gets sequential index (0, 1, 2, ...)
    │
    ▼
6. Upload chunks via Discord webhooks (rate-limited queue)
    │   - Each chunk: POST /webhooks/{id}/{token}?wait=true
    │   - multipart/form-data with files[0] = chunk blob
    │   - payload_json contains: fileId, chunkIndex, chunkTotal
    │   - Wait for response to get message_id + attachment info
    │
    ▼
7. Store chunk metadata in IndexedDB
    │   - message_id, attachment_id, CDN URL, channel_id
    │   - For each chunk: { chunkIndex, messageId, attachmentId, cdnUrl }
    │
    ▼
8. Update file record status to "complete"
```

### Download Flow

```
User clicks file to download/preview
    │
    ▼
1. Load file record from IndexedDB (status, chunk list, nonces)
    │
    ▼
2. For each chunk (sequential or parallel for preview):
    │
    ├──→ 2a. Check if CDN URL is still valid (check expiry `ex` param)
    │         - If expired: re-fetch message via GET /webhooks/{id}/{token}/messages/{message_id}
    │         - This returns fresh signed CDN URL
    │         - Update IndexedDB with new URL
    │
    ├──→ 2b. Fetch chunk bytes: GET {cdn_url}
    │         - Returns encrypted ciphertext for this chunk
    │
    ├──→ 2c. Decrypt chunk with AES-256-GCM (Web Worker)
    │         - Use stored nonce + derived key
    │
    └──→ 2d. Append to output buffer
    │
    ▼
3. Reassemble all decrypted chunks into original file
    │
    ▼
4. Create Blob from reassembled buffer
    │
    ▼
5. Serve to user: download as file, or stream for preview
    │
    ▼
6. For media: stream directly from CDN (decrypt on-the-fly)
    │   - Image: decrypt → createObjectURL → <img src>
    │   - Video: decrypt → createObjectURL → <video src>
    │   - Audio: decrypt → createObjectURL → <audio src>
```

## Component Map

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| **UI Layer** (React) | Render file browser, upload/download UI, media player | State Manager, Component Library |
| **State Manager** (Zustand) | Global app state — current folder, selected files, upload queue, auth state | IndexedDB Layer, Discord Client |
| **IndexedDB Layer** (Dexie.js) | Persist metadata — files, folders, versions, nonces, chunk locations, sharing tokens | None (browser API) |
| **Encryption Service** (Web Worker) | AES-256-GCM encrypt/decrypt with PBKDF2 key derivation | Web Crypto API |
| **Chunker Service** | Split files into ≤25MB chunks, reassemble on download | None (pure logic) |
| **Discord Client** | Execute webhooks (upload), fetch messages (URL refresh), handle rate limits | Discord API |
| **Rate Limiter** | Token bucket queue for Discord API requests, exponential backoff on 429 | None |
| **Media Player** | Persistent audio/video player that survives navigation | State Manager, Encryption Service |
| **Share Service** | Generate password-protected, time-limited share URLs (client-side only) | Encryption Service, IndexedDB Layer |
| **PWA Service Worker** | Cache static assets, enable offline shell | None (browser API) |

## Discord Integration Layer

### Webhook Upload

**Endpoint**: `POST https://discord.com/api/v10/webhooks/{webhook_id}/{webhook_token}?wait=true`

The `?wait=true` query parameter is critical — it makes Discord return the created message object (including attachment info and CDN URLs) instead of `204 No Content`.

**Request format**: `multipart/form-data`

```
--boundary
Content-Disposition: form-data; name="payload_json"
Content-Type: application/json

{
  "content": "{\"fileId\":\"abc123\",\"chunkIndex\":0,\"chunkTotal\":3,\"filename\":\"report.pdf\",\"uploadedAt\":\"2026-06-03T10:00:00Z\"}"
}
--boundary
Content-Disposition: form-data; name="files[0]"; filename="chunk_0.bin"
Content-Type: application/octet-stream

[encrypted chunk bytes]
--boundary--
```

**Key details**:
- File size limit: Default **10 MiB** per file for all users. May be higher for Nitro subscribers or boosted servers (up to 25 MiB with Nitro, 50 MiB+ with server boost). The PROJECT.md assumes 25 MiB as safe default.
- Each webhook execution creates one message with one attachment.
- The `content` field holds JSON-encoded metadata (file ID, chunk index, etc.) — max 2000 characters.
- Webhook names can contain `clyde` or `discord` — must avoid those substrings.

### CDN Retrieval

**Attachment CDN URL format**:
```
https://cdn.discordapp.com/attachments/{channel_id}/{message_id}/{filename}?ex={expiry}&is={issued}&hm={signature}
```

**Critical: Signed URLs expire.** The `ex` parameter is a hex Unix timestamp indicating when the URL expires. Discord auto-refreshes URLs that appear within the official Discord client, but **our app won't get this auto-refresh** — we must handle it ourselves.

**URL refresh strategy**:
1. Parse `ex` from the stored CDN URL
2. Check if current time > expiry time (with 5-minute buffer)
3. If expired: call `GET /webhooks/{id}/{token}/messages/{message_id}` with `wait=false`
4. Discord returns the message object with fresh signed attachment URLs
5. Update IndexedDB with the new URL

**Alternative**: Standard CDN endpoints (non-attachment) like `https://cdn.discordapp.com/attachments/{channel_id}/{message_id}/{filename}` without query params don't expire but **don't work for user-uploaded content** — only for Discord-owned assets (avatars, icons, etc.). We must use signed URLs.

### Rate Limit Handling

Discord applies multiple rate limit layers:

| Limit | Scope | Value | Notes |
|-------|-------|-------|-------|
| Global | Per bot/user | 50 requests/second | All API calls combined |
| Per-route | Per webhook | Varies (typically 5/5s) | Read `X-RateLimit-*` headers |
| Per-route (upload) | Per webhook | ~30/minute typical | Upload-heavy routes are stricter |

**Implementation: Token Bucket Rate Limiter**

```
class RateLimiter:
    queue: PriorityQueue<Request>
    tokens: number = MAX_TOKENS
    lastRefill: timestamp
    
    enqueue(request):
        queue.push(request)
        processQueue()
    
    processQueue():
        while queue not empty AND tokens > 0:
            request = queue.pop()
            execute(request)
            tokens -= 1
            read X-RateLimit-Remaining from response
            if Remaining == 0:
                wait until X-RateLimit-Reset-After
                refill tokens
    
    on429(response):
        wait retry_after seconds (from response body)
        retry request
```

**Strategies for parallel chunk uploads**:
- **Sequential upload** (safest): Upload chunks one at a time, wait for rate limit headers
- **Bounded parallel**: Upload 2-3 chunks simultaneously, throttle based on remaining quota
- **Webhook pool**: Create multiple webhooks (if allowed), distribute uploads across them
- **Recommended**: Bounded parallel with 2 concurrent uploads per webhook, with exponential backoff on 429

**Exponential backoff on 429**:
```
attempt 1: wait 1s
attempt 2: wait 2s
attempt 3: wait 4s
attempt 4: wait 8s
attempt 5: wait 16s
max: 60s
```

## IndexedDB Schema

Using Dexie.js wrapper for cleaner API. Database name: `wyvern-drive`, version: `1`.

### Table: `files`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string (UUID) | PK | Unique file identifier |
| `name` | string | yes | Original filename |
| `mimeType` | string | yes | MIME type (e.g., `application/pdf`) |
| `size` | number | yes | Original file size in bytes |
| `folderId` | string | yes | Parent folder ID (null = root) |
| `createdAt` | Date | yes | Creation timestamp |
| `updatedAt` | Date | yes | Last modified timestamp |
| `status` | enum | yes | `uploading` / `complete` / `failed` |
| `version` | number | | Current version number (starts at 1) |
| `encryptionSalt` | Uint8Array | | PBKDF2 salt for this file |
| `encryptionNonce` | Uint8Array | | AES-GCM nonce (12 bytes) |
| `chunkSize` | number | | Size of each chunk in bytes |
| `totalChunks` | number | | Number of chunks |
| `checksum` | string | | SHA-256 hash of original file (for integrity) |

### Table: `chunks`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string (UUID) | PK | Unique chunk identifier |
| `fileId` | string | yes (compound) | Parent file ID |
| `chunkIndex` | number | yes (compound) | Sequential index (0, 1, 2, ...) |
| `messageId` | string | yes | Discord message ID |
| `attachmentId` | string | | Discord attachment ID within message |
| `cdnUrl` | string | | Signed CDN URL (may expire) |
| `cdnExpiry` | Date | | When the CDN URL expires |
| `channelId` | string | | Discord channel ID |
| `size` | number | | Chunk size in bytes |
| `uploadedAt` | Date | | When this chunk was uploaded |

### Table: `folders`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string (UUID) | PK | Unique folder identifier |
| `name` | string | | Folder name |
| `parentId` | string | yes | Parent folder ID (null = root) |
| `path` | string | yes | Full path string (e.g., `/Documents/Work/`) |
| `createdAt` | Date | | Creation timestamp |
| `updatedAt` | Date | | Last modified timestamp |

### Table: `versions`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string (UUID) | PK | Version record ID |
| `fileId` | string | yes | Parent file ID |
| `versionNumber` | number | | Sequential version (1, 2, 3, ...) |
| `chunkIds` | string[] | | Ordered list of chunk IDs for this version |
| `createdAt` | Date | | When this version was created |
| `size` | number | | Size of this version in bytes |
| `checksum` | string | | SHA-256 hash |

### Table: `shares`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `id` | string (UUID) | PK | Share token ID |
| `fileId` | string | yes | File being shared |
| `passwordHash` | string | | Hashed share password (not user's encryption password) |
| `expiresAt` | Date | yes | Expiration timestamp |
| `createdAt` | Date | | Creation timestamp |
| `accessCount` | number | | Number of times accessed |
| `maxAccesses` | number | | Max allowed accesses (null = unlimited) |

### Table: `config`

| Field | Type | Description |
|-------|------|-------------|
| `key` | string (PK) | Configuration key |
| `value` | any | Configuration value |

Stores: webhook URLs, user settings, encryption password salt (if user opts in), UI preferences.

### Indexes Summary

```
files:     [folderId+name, status, mimeType, createdAt, updatedAt]
chunks:    [fileId+chunkIndex, messageId, cdnExpiry]
folders:   [parentId, path]
versions:  [fileId, fileId+versionNumber]
shares:    [fileId, expiresAt]
```

## Encryption Pipeline

### Password → Key Derivation (PBKDF2)

```
Input: user password (string), per-file salt (random 16 bytes)
    │
    ▼
1. Import password as raw key material:
   crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveKey"])
    │
    ▼
2. Derive AES-256-GCM key:
   crypto.subtle.deriveKey(
     {
       name: "PBKDF2",
       salt: salt,                    // 16 random bytes, stored per-file
       iterations: 600_000,           // OWASP 2023 recommendation
       hash: "SHA-256"
     },
     baseKey,
     { name: "AES-GCM", length: 256 },
     false,
     ["encrypt", "decrypt"]
   )
    │
    ▼
Output: CryptoKey object (AES-256-GCM, extractable: false)
```

### Encrypt File Chunk

```
Input: plaintext chunk (ArrayBuffer), CryptoKey, stored nonce
    │
    ▼
1. Generate nonce (if new upload):
   crypto.getRandomValues(new Uint8Array(12))  // 96-bit nonce for GCM
    │
    ▼
2. Encrypt:
   crypto.subtle.encrypt(
     {
       name: "AES-GCM",
       iv: nonce,
       tagLength: 128                // 128-bit auth tag
     },
     key,
     plaintextChunk
   )
    │
    ▼
Output: ciphertext ArrayBuffer (plaintext length + 16 bytes for auth tag)
```

### Decrypt File Chunk

```
Input: ciphertext (ArrayBuffer), CryptoKey, stored nonce
    │
    ▼
crypto.subtle.decrypt(
  {
    name: "AES-GCM",
    iv: nonce,
    tagLength: 128
  },
  key,
  ciphertextChunk
)
    │
    ▼
Output: plaintext ArrayBuffer (original chunk data)
```

### Security Notes

- **AES-GCM auth tag**: 128 bits — provides both confidentiality AND integrity. If ciphertext is tampered with, decryption fails.
- **Nonce uniqueness**: Each chunk must have a unique nonce. For new uploads, generate random 12 bytes. For re-encryption (e.g., version changes), generate fresh nonce.
- **Key never exported**: `extractable: false` prevents the key from being serialized. The key exists only in memory (and in the Web Worker's scope).
- **PBKDF2 iterations**: 600,000 is OWASP 2023 recommendation for SHA-256. On a modern device, this takes ~1-3 seconds, which is acceptable for login/unlock.
- **Web Worker isolation**: Encryption runs in a dedicated Web Worker to avoid blocking the main thread. All crypto operations are offloaded.

## Media Streaming

### In-Browser Preview (Images, Video, Audio)

Discord CDN serves files as binary blobs. To stream in-browser:

1. **Fetch encrypted chunk** from CDN URL
2. **Decrypt** in Web Worker (streaming if possible)
3. **Create Blob** from decrypted bytes
4. **Create Object URL**: `URL.createObjectURL(blob)`
5. **Assign to media element**: `<img src={url}>`, `<video src={url}>`, `<audio src={url}>`

### Streaming Strategy by Media Type

| Type | Strategy | Notes |
|------|----------|-------|
| **Image** (JPG/PNG/WebP) | Decrypt all chunks → single Blob → createObjectURL | Images are typically small, single-chunk |
| **Video** (MP4/WebM) | Decrypt all chunks → single Blob → createObjectURL → `<video>` | Browser handles seeking within Blob natively |
| **Audio** (MP3/OGG/WAV) | Same as video | `<audio>` element handles streaming from Blob |
| **PDF** | Decrypt → Blob → `<iframe>` or PDF.js viewer | Large PDFs may need progressive loading |
| **Text/Code** | Decrypt → `.text()` → render in `<pre>` or editor | Direct text rendering |

### Persistent Media Player

For audio player that survives navigation:
- Keep `<audio>` element outside React's render tree (in a persistent DOM node)
- Use Zustand store to track: current track, playlist, playback state, volume
- Player UI component reads from store; player element lives in a React portal or plain DOM
- On navigation change: player state persists in Zustand (in-memory), audio element keeps playing

### Video/Image Streaming Optimization

For large files (multi-chunk video):
- **Option A**: Decrypt all chunks, concatenate, create single Blob (simple, but uses more memory)
- **Option B**: Use `ReadableStream` to pipe chunks through decrypt → stream to `<video>` via MediaSource API (complex, but memory-efficient)
- **Recommended**: Option A for v1 — most browsers handle large Blobs well. Option B as future optimization for files >100MB.

## Sharing System

All sharing logic runs client-side. No server involvement.

### Share Link Format

```
https://your-domain.com/share/{shareId}#{encryptedPayload}
```

The `#` fragment is never sent to the server — the encrypted payload (containing file reference + password) stays client-side only.

### Share Creation Flow

```
1. User selects file to share
2. User sets: password, expiration, max accesses
3. Generate random shareId (UUID)
4. Encrypt file's CDN URLs + metadata with share password (AES-256-GCM)
5. Store share record in IndexedDB:
   { id, fileId, passwordHash, expiresAt, maxAccesses }
6. Generate share URL: /share/{shareId}#{base64(encryptedPayload)}
7. User shares URL via any channel
```

### Share Access Flow

```
1. Recipient opens share URL
2. App reads shareId from URL path
3. App reads encrypted payload from URL hash fragment
4. Prompt for password
5. Decrypt payload with password → get file metadata + CDN URLs
6. Fetch file chunks from CDN URLs
7. Decrypt chunks → reassemble → present file
8. Increment accessCount in IndexedDB
9. If expired or maxAccesses exceeded → deny
```

### Password Hashing for Shares

- Use SHA-256 to hash the share password (stored in IndexedDB)
- This is NOT the same as the encryption key — it's just for access control
- The actual encryption key for the share payload is derived from the share password via PBKDF2

## Build Order

Critical path — components are ordered by dependency. Each step must be completable before the next can meaningfully integrate.

```
1. Project scaffold + build tooling (Vite, React, TypeScript, Tailwind)
   └── depends on: nothing

2. IndexedDB schema + Dexie.js setup
   └── depends on: 1

3. Discord Client (webhook upload, message fetch, rate limiter)
   └── depends on: 1

4. Encryption Service (Web Worker: PBKDF2 + AES-256-GCM)
   └── depends on: 1

5. Chunker Service (split + reassemble)
   └── depends on: 1

6. Upload Pipeline (orchestrates: 2, 3, 4, 5)
   └── depends on: 2, 3, 4, 5

7. Download Pipeline (orchestrates: 2, 3, 4, 5)
   └── depends on: 2, 3, 4, 5

8. File Browser UI (list view, folder navigation)
   └── depends on: 2, 6, 7

9. Upload UI (drag-and-drop, progress tracking)
   └── depends on: 6, 8

10. Download/Preview UI (file actions, media preview)
    └── depends on: 7, 8

11. Folder System UI (create, rename, move, nested)
    └── depends on: 2, 8

12. File Versioning (version history, restore)
    └── depends on: 2, 6, 7

13. Search UI (filter by name, type, date)
    └── depends on: 2, 8

14. Media Player (persistent audio/video player)
    └── depends on: 7, 10

15. Share System (password-protected links)
    └── depends on: 2, 4, 7

16. Photo Timeline (gallery view)
    └── depends on: 8, 10, 14

17. Virtual Scrolling (performance for 10K+ files)
    └── depends on: 8

18. PWA Setup (manifest, service worker, offline shell)
    └── depends on: 1

19. Theme + Responsive Design (Discord-inspired dark theme)
    └── depends on: 8

20. Accessibility (keyboard nav, ARIA, WCAG AA)
    └── depends on: 8, 9, 10, 11

21. Integration Tests (mocked Discord API)
    └── depends on: 3, 6, 7
```

### Critical Path (longest dependency chain)

```
1 → 2/3/4/5 → 6 → 8 → 9 → 10 → 14
                                 → 15
```

**Minimum viable path**: Steps 1-10 give you a working encrypted file upload/download system with basic UI.

## Summary

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | React + Vite + TypeScript | Fast build, excellent DX, large ecosystem |
| **Styling** | Tailwind CSS v4 | Utility-first, Discord-like theming via config |
| **State** | Zustand | Lightweight, no boilerplate, works well with async |
| **IndexedDB** | Dexie.js | Promise-based API, schema versioning, indices |
| **Crypto** | Web Crypto API (native) | No external dependency, hardware-accelerated, AES-256-GCM |
| **Encryption** | Web Worker (dedicated) | Off-main-thread, no UI blocking during encrypt/decrypt |
| **ID generation** | UUID v4 (crypto.randomUUID) | Collision-free, no coordination needed |

### Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **CDN URL expiration** | Files become inaccessible | Store messageId, re-fetch fresh URLs via webhook API on access |
| **Rate limits** | Upload failures, slow operations | Token bucket queue, exponential backoff, bounded parallelism |
| **Browser storage limits** | IndexedDB quota exceeded | Metadata-only in IndexedDB (actual files on Discord CDN), request persistent storage |
| **Password loss** | All files permanently encrypted | Warn user during setup, optional password hint, key export mechanism |
| **Memory pressure** | Tab crash on large files | Stream processing via Web Workers, chunk-by-chunk operations |
| **Discord policy changes** | Webhook/CDN changes break app | Abstract Discord layer, monitor Discord changelog, version API calls |

### What Makes This Architecture Unique

1. **Zero server cost**: Discord provides unlimited storage + CDN for free via webhooks
2. **True end-to-end encryption**: Keys never leave the browser; Discord only sees encrypted blobs
3. **Offline-capable metadata**: IndexedDB stores all file structure; only actual file bytes are remote
4. **Progressive enhancement**: Works in any modern browser, installable as PWA
5. **Streaming decryption**: Can preview media without downloading entire file first
