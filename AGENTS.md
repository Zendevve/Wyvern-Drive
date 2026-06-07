# GSD Project Guide

This file is the entry point for the GSD (Get-Shit-Done) workflow on the Disbox v2 monorepo.

## What this project is

**Disbox v2** — a full rewrite of the original Disbox (Discord-as-cloud-storage). This is a greenfield monorepo: web app (Next.js 14), server (Hono + discord.js-selfbot-v13), Chrome extension (MV3), and a shared protocol SDK.

See `.planning/PROJECT.md` for full context, core value, and key decisions.

## Reading order for any workflow

1. `.planning/STATE.md` — current position, last activity, blockers
2. `.planning/ROADMAP.md` — overall phase structure and progress
3. `.planning/REQUIREMENTS.md` — what we are building
4. `.planning/PROJECT.md` — why and how
5. `.planning/research/SUMMARY.md` — gotchas and reference patterns

## Workflow commands

- `/gsd-progress` — show where we are
- `/gsd-plan-phase N` — plan a specific phase
- `/gsd-discuss-phase N` — gather context and clarify approach for a phase
- `/gsd-execute-phase N` — execute the plans for a phase
- `/gsd-verify-phase N` — verify a phase completed its success criteria
- `/gsd-transition N` — move from one phase to the next
- `/gsd-add-todo` — capture an idea for later

## Project conventions

- **Monorepo**: pnpm workspaces + turborepo. Run from repo root.
- **Stack is locked** — see PROJECT.md Key Decisions. Do not re-evaluate per phase.
- **YOLO mode** — auto-approve, just execute.
- **Vertical MVP** — each phase delivers a coherent, demoable capability.
- **Shared SDK is Phase 1** — do not start web or server work before the SDK exists.
- **v1 reference** lives in untracked `extension/`, `server/`, `web/` subdirs. Read for inspiration only; do not modify or commit.
- **Self-bot warning** must surface in any user-facing README or UI.

## Critical gotchas (from .planning/research/SUMMARY.md)

- Discord rate limits: ~5 messages / 5 s per channel; need server-side rate-limit-aware queue.
- Discord CDN URLs are public — anyone with the URL can download. This is the basis for share links AND the reason E2EE exists.
- better-sqlite3 is sync + single-process. No cluster, no pm2 cluster.
- WebCrypto subtle is async; run Argon2 in a Web Worker.
- AES-GCM AAD must include chunk index so chunks can't be reordered across files.
- MV3 service workers can't use IndexedDB transactionally across the message bus.
- Next.js 14 App Router + Zustand: create stores per-request on the server.

## v2 attempt cleanup

The prior v2 attempt (Hono + Vite + Argon2) is staged for deletion in the git index from a previous session. The first action in Phase 0 should be to commit those deletions as a single "wipe v2 attempt" commit before adding new files.
