---
spike: 002
name: competitor-chunking-rate-limiting
type: standard
validates: "Given Disbox and Discloud, when analyzed for upload mechanics, then how do they chunk files and handle Discord webhook rate limits?"
verdict: VALIDATED
related: []
tags: [chunking, uploads, rate-limits]
---

# Spike 002: Competitor Chunking and Rate Limiting

This spike analyzes how **Disbox** and **Discloud** perform file chunking and handle Discord API/webhook rate-limiting, and contrasts it with **Wyvern Drive**'s current implementation.

## What This Validates
- **Given** Disbox and Discloud codebases,
- **When** analyzed for upload mechanics,
- **Then** how do they chunk files, manage request concurrency, and handle rate limiting?

## Research

### Comparison of Chunking and Concurrency

| Aspect | Disbox | Discloud | Wyvern Drive |
|--------|--------|----------|--------------|
| **Default Chunk Size** | 25MB (max allowed by Discord CDN) | 8MB | 8MB |
| **Concurrency** | Sequential (1 at a time) | Sequential (1 at a time) | Parallel (3 concurrent task calls, but serialized by limiter) |
| **Queue Mechanics** | None (simple `for await` loop) | Array queue of file parts | Promise queue (`runWithConcurrency`) |
| **Rate Limit Sleep** | Pre-emptive based on headers + 429 catch retry | Linear delay (`uploadingCount * 1000ms`) + 429 header reset wait | Pre-emptive queue execution + Exponential Backoff / 429 retry |

### Key Findings & Deep Dive

#### 1. Rate Limiting in Disbox
Disbox checks the rate limit headers returned by Discord on *every* response:
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset-After`
If `remainingRequests === 0`, it blocks the next request by sleeping for `resetAfter` seconds.
If it gets a `429` error, it reads the `retry_after` field from the body and performs a recursive retry after sleeping. This type-specific rate-limit tracking ensures that it rarely hits actual 429s, but because it only processes one file/chunk at a time sequentially, it cannot maximize the available Discord webhook bandwidth.

#### 2. Rate Limiting in Discloud (And its bugs)
Discloud implements a linear queue delay:
- It maintains a global counter `uploadingCount`.
- When an upload starts, it waits `uploadingCount++ * 1000` milliseconds.
- This spaces out simultaneous uploads by 1 second each.
- In case of a `429` error, it attempts to wait:
  `await wait(+err.response.headers["x-ratelimit-reset-after"]);`
  > [!WARNING]
  > **Discloud Bug Identified:** `wait` takes milliseconds, but `x-ratelimit-reset-after` is in **seconds**. Discloud retries almost immediately (e.g. 5ms wait instead of 5000ms), resulting in cascading 429 errors.

#### 3. Wyvern Drive Rate Limiting & Concurrency Gap
Wyvern Drive has a sophisticated concurrent upload implementation:
- It splits files into 8MB chunks.
- It attempts to upload 3 chunks in parallel using `runWithConcurrency(uploadTasks, 3)`.
- **The Gap:** However, all Discord API calls are enqueued into a single global `RateLimiter` instance:
  ```typescript
  // src/lib/discord.ts
  const limiter = new RateLimiter();
  ```
  And `RateLimiter.processQueue()` processes tasks in a strictly sequential loop:
  ```typescript
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task(); // <--- Awaited sequentially!
    }
    this.processing = false;
  }
  ```
  Even though `uploadFile` spawns 3 parallel tasks, they are immediately queued and executed sequentially (one-by-one) by the global limiter. This negates the benefit of parallel chunks and limits upload speed.

## How to Run
This is a static code analysis spike. Code files reviewed:
- [disbox-file-manager.js:71-134](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/web/src/disbox-file-manager.js#L71-L134) (Disbox Webhook client)
- [discord.js:9-45](file:///d:/COMPROG/Wyvern%20Drive/.planning/tmp/competitors/discloud/services/discord.js#L9-L45) (Discloud upload queue)
- [rate-limiter.ts:21-29](file:///d:/COMPROG/Wyvern%20Drive/src/lib/rate-limiter.ts#L21-L29) (Wyvern Drive Rate Limiter loop)

## What to Expect
Clear definition of rate limit mechanics and concurrency issues across all three codebases.

## Results
- **Verdict**: **VALIDATED**
- We confirmed how competitors handle rate limits and identified a critical bug in Discloud's implementation.
- We discovered a major performance bottleneck in Wyvern Drive: the `RateLimiter` class serializes tasks, neutralizing the 3-task parallel upload configuration.
- **Signal for Wyvern Drive**:
  - We should refactor `RateLimiter` to allow a configurable degree of concurrency (e.g. `concurrencyLimit = 3`) instead of strict serialization. This will allow true parallel uploads up to Discord's rate limits.
  - We must ensure that any rate-limiting sleep correctly handles seconds-to-milliseconds conversion (unlike Discloud).
