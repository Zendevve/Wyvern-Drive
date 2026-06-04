---
spike: 005
name: competitor-comparative-matrix
type: comparison
validates: "Given Disbox and Discloud, when compared against Wyvern Drive, then what are the key feature gaps, weaknesses, and strengths to address?"
verdict: VALIDATED
related: [001, 002, 003, 004]
tags: [comparison, competitors]
---

# Spike 005: Competitor Comparative Matrix

This spike performs a head-to-head comparison of **Disbox**, **Discloud**, and **Wyvern Drive**. It details how Wyvern Drive can exploit competitor weaknesses and adopt their best features to establish itself as the definitive self-hosted, encrypted file storage client.

## Comparison Matrix

| Feature / Dimension | Disbox | Discloud | Wyvern Drive |
|---------------------|--------|----------|--------------|
| **Deployment Model** | Client-Server (Node + SQLite) | Client-Server (Node + Redis) | **Pure Static PWA** (Client-only) |
| **Operation Cost** | Hosting & Database costs | Hosting & Redis costs | **Zero cost** (Runs entirely in browser) |
| **Data Encryption** | None (Plaintext on Discord CDN) | None (Plaintext on Discord CDN) | **AES-256-GCM** (Client-side Web Crypto) |
| **Key Derivation** | N/A | N/A | **PBKDF2 with 600K iterations** |
| **Directory Folders** | Supported via database parent-child | Flat listing only | **Supported via IndexedDB relations** |
| **CDN Link Refreshing** | Always fetches on-demand | **None** (Fails after 24 hours) | **Smart Cached URL Refreshing** |
| **Upload Speed** | Sequential (single chunk) | Sequential (single chunk) | **Parallel Chunks** (Queue managed) |
| **Media Streaming** | Full download required | **HTTP Range Requests** (Streaming) | Proposed: **Service Worker Decryption** |
| **Offline Capabilities**| None | None | **Offline Metadata & App Shell (PWA)** |
| **Sharing Model** | Database entry duplicate | Proxy url endpoint | **Cryptographic sharing keys in URLs** |
| **CORS Bypassing** | Web extension helper | Node Server proxy | proposed: **PWA client proxy/extension** |

---

## Detailed Analysis & Competitor Weaknesses

### 1. The Discloud Expiration Crisis
- **Weakness**: Discloud stores raw CDN links permanently in Redis and lacks a refresh mechanism. All uploads expire and become inaccessible after 24 hours.
- **Wyvern Drive Strategy**: Store the Discord `messageId` and attachment metadata. We check the `ex` URL query parameter, calculate expiry with a safety buffer, and query the Discord webhook to fetch fresh URLs only when they expire. This preserves bandwidth and bypasses the 24-hour limit permanently.

### 2. Disbox's Webhook Key Exposure
- **Weakness**: Disbox sends the user's Webhook URL/identity to a central SQLite backend. If compromised, the attacker gains full access to all user files.
- **Wyvern Drive Strategy**: Keep the webhook URL and encryption keys strictly within the user's local browser context (`IndexedDB` or `localStorage`). For multi-device sync, we will implement an **encrypted database export** feature that serializes the IndexedDB metadata, encrypts it, and posts it to a designated message in the user's private Discord server.

### 3. Discloud's Streaming Capability
- **Strength**: Discloud supports partial content streaming (`Range` headers) by chunking and piping the requested byte ranges directly to the client.
- **Wyvern Drive Strategy**: We should implement a **Service Worker** inside our PWA. The Service Worker will intercept requests to `/stream/:fileId`, fetch the encrypted chunks, decrypt them on-the-fly, and respond with partial bytes (`206 Partial Content`) to satisfy HTML5 video and audio players.

---

## Action Plan to Make Wyvern Drive the Definitive Solution

To make Wyvern Drive the ultimate client-side file storage app, we must execute the following actions:

1. **Verify RateLimiter Concurrency**: Refactor our `RateLimiter` class in `src/lib/rate-limiter.ts` to allow a configurable concurrency degree (e.g., `concurrencyLimit = 3`) rather than processing tasks one-by-one.
2. **Robust CDN Link Refreshing**: Ensure the `refreshCdnUrl` helper fetches the message from the webhook (`GET https://discord.com/api/webhooks/{id}/{token}/messages/{messageId}`) and caches the new URL.
3. **PWA Service Worker Decryption**: In a future phase, create a Service Worker that intercepts `/stream/:fileId` routes to enable zero-latency, range-based decryption and streaming of large videos and audio tracks.
4. **Encrypted Sync Mechanism**: Add a backup import/export utility to allow users to sync their file hierarchy across devices by uploading/downloading encrypted metadata payloads to/from their Discord channel.
