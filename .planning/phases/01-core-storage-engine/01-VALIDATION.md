---
phase: 1
slug: core-storage-engine
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | npm run test |
| **Full suite command** | npm run test |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | Project Config | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | JWT Auth | T-1-02 | JWT signature verification | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | Upload/Chunking | T-1-03 | Reject chunks > 24MB | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | Download/Stream | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 2 | CDN Refresh | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 2 | Deletion | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` and dependency installs (Fastify, Vitest, typescript, etc.)
- [ ] `vitest.config.ts` configuration file
- [ ] `tests/setup.ts` setup file with `@discordjs/rest` mocks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Discord Webhook E2E | Real-world file upload/download integration | Requires valid Discord API credentials / Webhook URL | Run the E2E script with a temporary webhook URL to verify successful upload, download, and delete against live Discord servers. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-04
