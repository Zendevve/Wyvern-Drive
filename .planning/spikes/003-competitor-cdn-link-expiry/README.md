---
spike: 003
name: competitor-cdn-link-expiry
type: standard
validates: "Given Discord's expiring CDN attachment URLs, when analyzed for file retrieval, then how do these projects refresh and resolve links?"
verdict: VALIDATED
related: []
tags: [cdn, urls, resolution]
---

# Spike 003: Competitor CDN Link Expiry Handling

This spike analyzes how **Disbox** and **Discloud** address Discord's late-2023 link security policy (where CDN attachment URLs expire after 24 hours), and compares their solutions to **Wyvern Drive**.

## What This Validates
- **Given** Discord's expiring CDN attachment URLs,
- **When** analyzed for file retrieval,
- **Then** how do these projects refresh, resolve, or proxy expired links over time?

## Research

### Comparison of CDN URL Expiration Handling

| Aspect | Disbox | Discloud | Wyvern Drive |
|--------|--------|----------|--------------|
| **Stores Message IDs?** | Yes (in SQLite database) | No (only stores raw CDN URLs in Redis) | Yes (in IndexedDB `chunks` store) |
| **Caches CDN URLs?** | No (fetches fresh on every download) | Yes (stores raw URL permanently in Redis) | Yes (caches URL in IndexedDB with `cdnExpiry` tracking) |
| **Refresh Trigger** | On-demand on every download | None | On-demand only when cached URL is close to expiration (using `ex` parameter parameter check) |
| **Long-Term Retrieval Status** | Works permanently | **Broken (fails after 24 hours)** | Works permanently and efficiently |

### Detailed Findings

#### 1. Disbox URL Refreshing
Disbox handles URL expiration by avoiding long-term URL caching altogether:
- The database stores only Discord Message IDs.
- When a user requests a file download, Disbox's frontend calls the Webhook API `GET /messages/{messageId}` for each chunk's message.
- It parses the fresh response and uses the new URL immediately.
- **Evaluation**: This works reliably but is highly inefficient, as it consumes a Webhook API request for *every single chunk retrieval*, hitting rate limits much faster.

#### 2. Discloud URL Expiration Failure
Discloud does not account for Discord's CDN URL expiration:
- It only saves the raw CDN attachment URL in Redis during the upload flow:
  ```javascript
  uploadedParts.push(url); // e.g. "https://cdn.discordapp.com/attachments/..."
  ```
- When serving downloads, it fetches these saved URLs directly.
- **Evaluation**: **Critical Failure**. Any file stored on Discloud for more than 24 hours will return a `403 Forbidden` error from the Discord CDN, rendering the file completely unretrievable.

#### 3. Wyvern Drive URL Caching & Refreshing
Wyvern Drive implements the most robust and optimized pattern:
- It stores the `messageId`, `attachmentId`, and the cached `cdnUrl` alongside its parsed `cdnExpiry` date in IndexedDB.
- When downloading, it checks if the current time is close to `cdnExpiry` (using `isCdnExpired`):
  ```typescript
  export function isCdnExpired(url: string): boolean {
    const expiry = parseCdnExpiry(url); // extracts 'ex' parameter
    if (!expiry) return false;
    return Date.now() > expiry.getTime() - CDN_BUFFER_MS;
  }
  ```
- If the URL is still valid, it uses it directly, saving network calls and avoiding Discord Webhook rate limits.
- If it has expired, it calls `refreshCdnUrl` which fetches the message from Discord, updates the cache, and continues.

## How to Run
This is a static code analysis spike. Code files reviewed:
- [disbox-file-manager.js:141-149](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/web/src/disbox-file-manager.js#L141-L149) (Disbox fetch logic)
- [index.js:123-125](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/discloud/index.js#L123-L125) (Discloud Redis structure)
- [index.js:210-230](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/discloud/index.js#L210-L230) (Discloud file server fetch loop)
- [download.ts:24-29](file:///d:/COMPROG/Wyvern%20Drive/src/lib/download.ts#L24-L29) (Wyvern Drive cached download checks)

## What to Expect
A clear mapping of how each project manages the lifetime of Discord attachment URLs, identifying why Discloud fails and how Wyvern Drive's caching is optimal.

## Results
- **Verdict**: **VALIDATED**
- We validated that storing the Discord `messageId` and fetching/refreshing the CDN URL on demand is the only way to support long-term file storage.
- We confirmed that Discloud's design is fatally flawed for long-term use.
- We validated that Wyvern Drive's check-and-refresh caching mechanism is the most efficient design, reducing unnecessary Discord API requests.
- **Signal for Wyvern Drive**:
  - Keep the existing `isCdnExpired` and `refreshCdnUrl` logic, as it represents the industry best practice for self-hosted Discord storage.
