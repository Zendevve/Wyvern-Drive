---
spike: 004
name: competitor-discloud-mechanics
type: standard
validates: "Given the `phongna07/discloud` repository, when analyzed for codebase architecture, then how does it manage files, chunks, metadata, and Discord CDN URLs?"
verdict: VALIDATED
related: [001, 002, 003]
tags: [competitor, discloud]
---

# Spike 004: Competitor Discloud Mechanics

This spike explores the architecture, mechanisms, and codebase of **Discloud** (`phongna07/discloud`), documenting how it manages chunks, rate limits, metadata, streaming, and CDN URLs, identifying both its strengths and architectural bugs.

## What This Validates
- **Given** the `phongna07/discloud` repository,
- **When** analyzed for codebase architecture,
- **Then** how does it manage file uploads, chunking, metadata storage, streaming, rate limiting, and Discord CDN URLs?

## Research

### Codebase Overview & Architecture
Discloud is built as a server-backed Node.js application using Express and Redis. 

1. **Host-Centric Flow**: Unlike Disbox or Wyvern Drive (which are client-side first or purely client-side), Discloud runs a server proxy. The client interacts with the Express API (`/upload` and `/file/:id`), and the server interacts with Discord using a Discord Bot Token.
2. **Redis Metadata Cache**: Metadata is stored as serialized JSON strings in Redis under a random `fileId` hash.
3. **No Encryption**: Chunks are uploaded and stored in Discord channels in their original, unencrypted plaintext form.

---

### Detailed Mechanics & Findings

#### 1. File Chunking & Streaming Uploads
- **Upload Flow**: The server accepts files streamed via a POST request to `/upload?fileName=...`.
- **Chunk Partitioning**: It accumulates incoming stream buffers into an array of chunks. While the accumulated buffer length exceeds `CHUNK_SIZE` (set to `8,388,608` bytes, or 8MB), it slices off an 8MB block and pushes it to an upload queue (`filesToUpload`).
- **Linear Queue Delay**: To prevent rate limits, Discloud implements a spacing delay:
  ```javascript
  let uploadingCount = 0;
  // ...
  export const uploadToDiscord = async (token, channelId, file, fileName) => {
    await wait(uploadingCount++ * 1000);
    // ... upload request ...
    // .finally(() => uploadingCount--)
  };
  ```
  This spaces out concurrent uploads by 1 second multiplied by the current uploading count.

#### 2. Discord API Integration: Bot Token vs. Webhooks
- **Authentication**: Discloud uses a Discord Bot Token and sends files to `https://discord.com/api/channels/{channelId}/messages` using the `Authorization: Bot {token}` header.
- **Limitation**: This requires running a Node.js server. A client-side static PWA cannot securely expose a Bot Token to users.

#### 3. Download Streaming & Range Request Resolution
One of Discloud's notable strengths is its support for **HTTP Range Requests** (`Accept-Ranges: bytes`), allowing video and audio streaming:
- When a client sends a request with a `Range` header (e.g. `Range: bytes=start-end`), Discloud maps this range to the relevant chunk parts:
  ```javascript
  const startPartNumber = Math.ceil(start / info.chunkSize) - 1;
  const endPartNumber = Math.ceil(end / info.chunkSize);
  const partsToDownload = info.parts.slice(startPartNumber, endPartNumber);
  ```
- It requests the exact byte ranges from the Discord CDN using the `Range` header, since the Discord CDN itself supports range requests:
  ```javascript
  const headers = part.start || part.end ? { Range: `bytes=${part.start || 0}-${part.end || ""}` } : {};
  axios.get(part.url, { headers, responseType: "stream" })
  ```
- **Backpressure Handling**: It uses a custom `Transform` stream (`AsyncStreamProcessor`) to pipe the data to the Express response stream, pausing the source stream if the socket buffer is full (i.e. checking if `res.write(data)` returns false and waiting for the `drain` event).

#### 4. Critical Architecture & Logic Bugs

##### Bug A: Millisecond-to-Second Rate Limit Bug
In `services/discord.js`, Discloud catches rate limit errors and reads the reset duration:
```javascript
.catch(async (err) => {
  // Auto retry if the request is rate limited recursively
  await wait(+err.response.headers["x-ratelimit-reset-after"]);
  // ...
})
```
- **The Issue**: Discord returns `x-ratelimit-reset-after` in **seconds** (e.g. `5.25`). The helper function `wait(ms)` sleeps in **milliseconds**.
- **The Impact**: The code sleeps for only `5` milliseconds instead of `5250` milliseconds, immediately repeating the request and causing cascading rate-limiting blocks.

##### Bug B: Permanent Expiry of File Links
- **The Issue**: Discloud saves the full Discord CDN attachment URL directly in Redis during the upload step.
- **The Impact**: Since late 2023, Discord CDN attachment URLs expire after 24 hours. Because Discloud does not store Discord `messageId`s, it cannot refresh the URLs. After 24 hours, all stored files return `403 Forbidden` and become permanently unretrievable.

---

## How to Run & Verify
1. Examine code directly in:
   - [index.js](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/discloud/index.js)
   - [discord.js](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/discloud/services/discord.js)
   - [stream.js](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/discloud/utils/stream.js)
2. No runtime execution is necessary because the bugs and architectural patterns are obvious from static inspection.

## Results & Verdict
- **Verdict**: **VALIDATED**
- We have fully mapped Discloud's mechanics, confirming both its clever integration of HTTP Range requests for media streaming and its fatal design flaws (lack of encryption, expiring URLs, rate-limit sleep bug).
- **Lessons for Wyvern Drive**:
  1. **HTTP Range Support**: Wyvern Drive must support HTTP Range requests for streaming media. Since Wyvern Drive is a client-side PWA, it can achieve this by implementing a **Service Worker** that intercepts media network requests and serves partial crypto streams decrypted on-the-fly.
  2. **Webhook CDN Link Refreshing**: Wyvern Drive must continue utilizing its Message-ID-driven link refreshing to avoid the 24-hour expiration death that plagues Discloud.
