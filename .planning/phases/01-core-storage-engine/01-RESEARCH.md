# Phase 1: Core Storage Engine - Research

This research document analyzes the technical requirements and architecture for Phase 1 (Core Storage Engine) of Wyvern Drive, drawing insights from the reference repositories.

---

## 1. Discord Webhook API & Client Integration

The Core Storage Engine handles chunked file transfers directly using Discord Webhooks.

### Webhook Authentication and Endpoint Formats
A Discord webhook is uniquely identified by its URL:
`https://discord.com/api/webhooks/{webhookId}/{webhookToken}`

- **Message Post (Upload):**
  - **Method:** `POST`
  - **URL:** `/webhooks/{webhookId}/{webhookToken}?wait=true` (Adding `?wait=true` forces Discord to return the created message object containing the attachment metadata).
  - **Payload:** Multipart/form-data with a `file` field containing the binary chunk and an optional `payload_json` field containing message text or embed metadata.
- **Message Fetch (CDN Refresh):**
  - **Method:** `GET`
  - **URL:** `/webhooks/{webhookId}/{webhookToken}/messages/{messageId}`
  - **Response:** The JSON message object containing the refreshed attachment URLs.
- **Message Delete (Deletion):**
  - **Method:** `DELETE`
  - **URL:** `/webhooks/{webhookId}/{webhookToken}/messages/{messageId}`

### Client Layer (`@discordjs/rest`)
We will use `@discordjs/rest` to interact with these endpoints:
```typescript
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const rest = new REST({ version: '10' });

// Uploading a file chunk (Stateless, no Bot token)
const response = await rest.post(
  Routes.webhook(webhookId, webhookToken),
  {
    files: [{ name: chunkFileName, data: chunkBuffer }],
    query: new URLSearchParams({ wait: 'true' }),
    auth: false // Bypass Bot authorization header
  }
);
```

---

## 2. Stateless Session and JWT Architecture

To maintain a zero-cost, server-side storage-free VPS deployment, the server operates statelessly:
- **Authentication:** The client logs in by sending their Discord Webhook URL.
- **JWT Generation:** The server signs the Webhook URL using `HS256` with a server-side secret key (e.g., `JWT_SECRET`).
  - **Payload:** `{ webhookUrl: "https://discord.com/api/webhooks/..." }`
- **Verification:** For subsequent requests, the client passes this JWT in the `Authorization: Bearer <token>` header. The server verifies the signature and extracts the Webhook URL.
- **Account Isolation:** When checking virtual filesystem node associations (in later phases), the server derives an `accountId` by taking the `SHA-256` hash of the Webhook URL. This prevents users from accessing each other's database indices even if they share the same metadata database.

---

## 3. Streaming and Chunking Engine

### Chunking Constraints
- **Maximum Chunk Size:** 24MB (`25,165,824` bytes) to guarantee that chunks remain under Discord's strict 25MB (`26,214,400` bytes) upload limit.
- **Upload Flow:**
  - Files are received via Fastify multipart upload (e.g., using `@fastify/multipart`).
  - The incoming file stream is partitioned into 24MB chunks.
  - Chunks are uploaded concurrently (concurrency limit = 3) to optimize speed.
  - The API returns a list of upload descriptors to the client:
    ```json
    [
      { "id": "message_id_1", "size": 25165824, "url": "https://cdn.discordapp.com/...", "index": 0 },
      { "id": "message_id_2", "size": 1200500, "url": "https://cdn.discordapp.com/...", "index": 1 }
    ]
    ```

### Reassembly & Download Flow
- **Download Flow:**
  - The client requests a download by passing the array of chunk descriptors.
  - The server streams the response back. It downloads chunks sequentially, piping them to the client's HTTP response stream.
  - **CDN Link Expiry Handling:** Discord attachments now expire after 24 hours. The download URL will fail with a `403 Forbidden` or `404 Not Found` if accessed after 24 hours.
  - **Refresh Strategy:** If download fails (status `403` or `404`), the server calls `@discordjs/rest` to get the updated message details via `GET /webhooks/{webhookId}/{webhookToken}/messages/{messageId}`. This returns a fresh attachment URL containing new `ex` (expiry), `is`, and `hm` signature parameters.

---

## 4. Rate Limiting Mitigation

Discord's Webhook API rate limits are per-webhook and allow roughly 30 requests per minute.
- **Handling limits:** `@discordjs/rest` has a built-in rate limiter that tracks `X-RateLimit-Remaining` and `X-RateLimit-Reset-After` headers and pauses requests dynamically when limits are reached.
- **Queueing:** By specifying a maximum upload concurrency of 3, we prevent massive bursts of rate-limiting delays and maintain a stable throughput.

---

## 5. Validation Architecture

We will verify the implementation using **Vitest** for unit and integration testing.

- **Mocking Discord REST calls:**
  - We will mock the HTTP responses of `@discordjs/rest` to simulate successful uploads, downloads, rate limits (HTTP 429), and expired CDN URLs (HTTP 403 / 404).
- **Fastify Route Integration Tests:**
  - Use `app.inject()` to test routes without starting a listening server on a TCP port.
  - Test `/auth` (JWT generation/validation).
  - Test `/upload` (multipart streaming, chunking, metadata return).
  - Test `/download` (sequential stream reassembly, rate limit handling, CDN auto-refresh on 403).
  - Test `/delete` (deleting attachments).
