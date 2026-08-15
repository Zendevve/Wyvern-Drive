# Rate Limiting, Jitter, and Transfer Resilience

This document explains how Wyvern Drive handles Discord API rate limits, network partitions, and transfer failures gracefully.

---

## 1. Discord's Rate-Limiting Mechanics

Discord enforces strict rate limits on webhook endpoints to prevent abuse. Webhook requests generally operate under a per-route bucket:
- **Upload Rate Limit**: Approximately 5 requests every 2 seconds per webhook.
- **Payload Response**: When the limit is exceeded, Discord responds with **HTTP 429 (Too Many Requests)** containing a JSON payload:
  ```json
  {
    "message": "You are being rate limited.",
    "retry_after": 1.5,
    "global": false
  }
  ```

---

## 2. Exponential Backoff & Dynamic Jitter in `pkg/discord`

When Wyvern Drive detects an HTTP 429 status during a multipart chunk upload:

1. **Parse `retry_after`**:
   The client parses Discord's exact `retry_after` float value (in seconds) from the response body.

2. **Exponential Fallback**:
   If `retry_after` is missing or unparseable, the client falls back to exponential backoff:
   $$\text{Delay} = 2^{\text{attempt}} \times 500\text{ms}$$

3. **Context Cancellation Awareness**:
   If the user cancels the upload while waiting in a rate-limit sleep, the worker exits immediately via `select { case <-ctx.Done(): ... }`.

```go
if resp.StatusCode == http.StatusTooManyRequests {
    var rl RateLimitResponse
    retryDelay := time.Duration(1<<attempt) * time.Second
    if jsonErr := json.Unmarshal(respBody, &rl); jsonErr == nil && rl.RetryAfter > 0 {
        retryDelay = time.Duration(rl.RetryAfter*1000) * time.Millisecond
    }

    select {
    case <-ctx.Done():
        return nil, "", ctx.Err()
    case <-time.After(retryDelay):
        continue // Retry chunk upload
    }
}
```

---

## 3. Worker Pool Concurrency Tuning

To prevent overwhelming the webhook bucket while maintaining high transfer speeds:
- Wyvern Drive limits concurrent chunk uploads to **4 parallel workers** by default.
- Users on slower connections or high-latency networks can adjust the worker concurrency slider between **1 and 8 threads** in Settings.
- Chunks that fail due to transient network drops are retried up to 5 times before marking the transfer as failed.
