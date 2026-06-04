# Phase 1: Core Storage Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 1-Core Storage Engine
**Areas discussed:** Backend Framework Selection, Discord Client Layer, Upload Concurrency & Throttling, JWT Authentication Scheme

---

## Backend Framework Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Fastify | Extremely fast, native schema validation, first-class TypeScript support. | ✓ |
| Express | The industry default; very simple, but slower async error handling. | |
| Hono | Minimalist, web-standards compliant, works out-of-the-box with Vite. | |

**User's choice:** Fastify
**Notes:** Decided to use Fastify for its high performance and robust TypeScript support.

---

## Discord Client Layer

| Option | Description | Selected |
|--------|-------------|----------|
| Native `fetch` API | Keeps dependency list clean and lightweight. | |
| `@discordjs/rest` | Robust REST manager from Discord.js, handles rate-limiting automatically. | ✓ |
| Other | Freeform custom options. | |

**User's choice:** `@discordjs/rest`
**Notes:** Relying on `@discordjs/rest` avoids writing custom queue/retry mechanisms for rate limits.

---

## Upload Concurrency & Throttling

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential Upload (1 chunk at a time) | Easier to track progress and less likely to trigger rate limit blocks. | |
| Concurrent Upload (Concurrency of 3) | Speeds up uploads of larger files by sending multiple chunks simultaneously. | ✓ |
| Other | Freeform custom options. | |

**User's choice:** Concurrent Upload (Concurrency of 3)
**Notes:** Let `@discordjs/rest` handle the queue/backoff and leverage concurrent uploads to speed up operations.

---

## JWT Authentication Scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Standard Signed JWT (HS256) | Contains plaintext webhook URL, signed with server secret. | ✓ |
| Encrypted JWT (JWE) / AES-256-GCM | Fully hides the webhook URL from the client's local storage. | |

**User's choice:** Standard Signed JWT (HS256)
**Notes:** A signed JWT is sufficient since the client already knows the webhook URL they configured.

---

## the agent's Discretion

The agent has discretion over standard package selections (routing, TS configurations, and testing libraries) and minor API endpoint designs.

## Deferred Ideas

None.
