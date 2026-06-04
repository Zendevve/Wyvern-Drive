# Phase 11: Concurrent Upload Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 11-Concurrent Upload Pipeline
**Areas discussed:** Concurrency Configuration, Pre-emptive Rate Limit Scope, Queue Prioritization, Error Propagation

---

## Concurrency Configuration & Control

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (Dynamic Settings) | Expose a slider in the Settings UI | |
| Option B (Constructor/Task Parameter) | Keep it as a parameter on RateLimiter creation | ✓ |
| Option C (Hardcoded Global) | A hardcoded constant | |

**User's choice:** Agent Discretion (Option B selected)
**Notes:** Configured via RateLimiter constructor.

---

## Pre-emptive Rate Limit Bucket Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (Per-Webhook Buckets) | Track limits per Webhook ID | |
| Option B (Global Discord Bucket) | Single global bucket tracker | |
| Option C (Bucket Headers Only) | Dynamic tracking using X-RateLimit-Bucket header | ✓ |

**User's choice:** Agent Discretion (Option C selected)
**Notes:** Read dynamic bucket headers.

---

## Queue Prioritization (Uploads vs Downloads)

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (FIFO) | Standard First-In-First-Out queue | ✓ |
| Option B (Priority Queue) | Priority flags for enqueued tasks | |

**User's choice:** Agent Discretion (Option A selected)
**Notes:** FIFO queue is robust and simple.

---

## Error Propagation & Cancelation

| Option | Description | Selected |
|--------|-------------|----------|
| Option A (Fail Fast) | Cancel/reject other pending chunk uploads immediately | ✓ |
| Option B (Let Execute) | Let running chunk uploads finish, then fail | |

**User's choice:** Agent Discretion (Option A selected)
**Notes:** Fail fast to optimize API usage.

---

## the agent's Discretion

All configuration, architecture, prioritization, and error propagation decisions were deferred to the agent.

## Deferred Ideas

- Settings UI control for dynamic concurrency.
