---
phase: 10-agents-md
plan: 01
subsystem: docs
tags: [docs, agents-md, design-discipline, a11y, motion, perf]
dependency_graph:
  requires: [09-01]
  provides: [AGENTS.md durable rule set]
  affects: [future agents and humans editing UI/theme/icons/motion/a11y]
tech_stack:
  added: []
  patterns: [durable rule docs referencing live source-of-truth files]
key_files:
  created:
    - AGENTS.md
  modified: []
decisions:
  - "AGENTS.md references live source files (tokens.ts, index.css, icon-map.ts, useReducedMotion.ts) rather than duplicating their content, so the doc and the code cannot drift silently (mitigates T-10-01)."
  - "Marketing-page patterns (hero, bento, marquee, eyebrow cap, zigzag, trusted-by wall, scroll-cue, premium consumer palette, Marrow, holographic) are listed ONLY in the Out of Scope section, never as active guidance (mitigates T-10-02)."
  - "Phosphor version pinned at ^2.1.7 to match the dependency that was actually installed in Phase 7, not a newer version."
metrics:
  duration: "~3 min"
  completed_date: "2026-06-04"
  lines_written: 110
---

# Phase 10 Plan 01: AGENTS.md Durable Rule Set Summary

One-liner: Codified the design, a11y, motion, and perf conventions established in Phases 06-09 into a single scannable AGENTS.md at the repo root, with marketing-page patterns explicitly listed as out of scope.

## What Was Built

- `AGENTS.md` at the repo root: 11 sections, 85 lines, 898 words.
- All cross-references point to live source files (`src/constants/tokens.ts`, `src/index.css`, `src/components/icon-map.ts`, `src/hooks/useReducedMotion.ts`).
- "Out of Scope" section explicitly bans marketing-page patterns (hero, bento, marquee, eyebrow cap, zigzag, trusted-by wall, scroll-cue, premium consumer palette, Marrow, holographic, carousel sections) and tells the agent to decline such requests with a dashboard-appropriate alternative.
- Anti-Patterns section bans emoji-as-icon, hardcoded Tailwind color literals, raw z-N classes, rounded-2xl/3xl, neon outer glow, `h-screen`, `transition-all` misuse, the em-dash `—` (U+2014) in user-facing strings, and undocumented new dependencies.

## Verification Results

| Check | Result |
|-------|--------|
| `AGENTS.md` exists at repo root | PASS |
| Line count < 400 | PASS (85 lines) |
| All 11 sections present | PASS |
| Marketing vocab confined to section 9 | PASS (grep across all 11 sections; no violations outside "Out of Scope") |
| `npm run test` | PASS (28/28 tests) |
| `npm run build` | PASS (tsc + vite build, 4691 modules transformed) |

## Deviations from Plan

None - plan executed exactly as written. The markdown content in the plan was used verbatim for AGENTS.md. One cosmetic judgement: the plan example for icons said "28–48px for hero-of-control" — that phrase "hero-of-control" is the plan's own wording for "large control icons (audio album, drop overlay)" and is not a hero section; it stays.

## Threat Mitigation

- **T-10-01 (Repudiation — rules drift over time):** Mitigated. AGENTS.md links live token files; the doc cannot silently drift from the code.
- **T-10-02 (Tampering — marketing rules leak into active sections):** Mitigated. Grep gate passed: marketing vocabulary appears only in section 9.
- **T-10-SC (Tampering — npm installs):** Accepted. No new dependencies introduced.

## Notes for Future Phases

- AGENTS.md is now the entry point for any new agent. It will be loaded at the start of every future `/gsd-execute-phase` invocation.
- The grep gate used to verify T-10-02 (`rg -n "hero|bento|marquee|eyebrow|zigzag|trusted-by|scroll-cue|premium consumer palette|Marrow" AGENTS.md` filtered to non-section-9 lines) is a good candidate to be promoted to a `pre-commit` hook or a CI grep check in a future phase, but that is out of scope for this plan.
