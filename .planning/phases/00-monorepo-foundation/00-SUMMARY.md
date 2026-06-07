---
gsd_summary_version: '1.0'
phase: 00-monorepo-foundation
plan: 01
subsystem: tooling
tags: [monorepo, pnpm, turborepo, eslint, prettier, ci]
---

# Phase 0 — Monorepo & Tooling Foundation

## What shipped

pnpm 9 + turborepo 1 monorepo with 4 workspace packages:

- `apps/web` — stub (filled in Phase 3)
- `apps/server` — stub (filled in Phase 2)
- `apps/ext` — stub (filled in Phase 4)
- `packages/shared` — real working SDK skeleton (`tsc + esbuild` dual ESM/CJS)

Root scripts: `build`, `dev`, `lint`, `typecheck`, `test`, `clean`, `format`, `format:check` — all delegated through turbo.

ESLint 9 flat config (root `eslint.config.mjs`) — applied to shared; app stubs are no-op until their phase fills them.

Prettier: 2-space, single quotes, trailing commas, 100-col, LF.

GitHub Actions CI workflow at `.github/workflows/ci.yml` — install → format-check → lint → typecheck → build → test.

## Cleanup landed

- Prior v2 attempt (108 files, Hono + Vite + Argon2) committed as `chore: wipe v2 attempt`.
- v1 reference (`extension/`, `server/`, top-level `web/`) anchored to root in `.gitignore` — stays untracked for future reference without polluting `apps/`.

## Deviations from plan

- Apps simplified to stub-only `package.json` (no `next`/`react`/`better-sqlite3`/`discord.js-selfbot-v13` etc.). Heavy deps land in their respective product phase. Keeps `pnpm install` under 12s.
- `lint` script in apps is `echo … && exit 0` placeholder until each phase installs its own linter.
- `test` script in shared also no-op until Phase 1 adds the real vitest suite.

## Key files

- `package.json` — root, name `disbox`, pnpm@9, all scripts
- `pnpm-workspace.yaml` — `apps/*` and `packages/*`
- `turbo.json` — pipeline with `build` / `dev` (cache:false, persistent) / `lint` / `typecheck` (`dependsOn: [^build]`) / `test` / `clean`
- `tsconfig.base.json` — strict, ES2022, Bundler resolution, `noUncheckedIndexedAccess`
- `eslint.config.mjs` — flat config using `@eslint/js` + `typescript-eslint`
- `.github/workflows/ci.yml` — CI on push/PR to master
- `packages/shared/scripts/bundle.mjs` — esbuild dual ESM/CJS bundle
- `.gitattributes` — `* text=auto eol=lf` (silences CRLF noise on Windows)

## Acceptance verification

| Criterion                                  | Result                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `pnpm install` < 60s                       | ✅ 11.8s cold, 951ms warm                                           |
| `pnpm -r build` produces `dist/` in shared | ✅ `index.js`, `index.cjs`, `index.d.ts`, source maps               |
| `pnpm -r typecheck` passes                 | ✅                                                                  |
| `pnpm -r lint` passes                      | ✅ (shared uses real flat config)                                   |
| 4 workspaces listed by `pnpm -r list`      | ✅ `@disbox/web`, `@disbox/server`, `@disbox/ext`, `@disbox/shared` |
| `pnpm format:check` passes                 | ✅ (bonus)                                                          |

## What this enables

Phases 1–10 can each `pnpm add` their own deps inside their workspace without touching root. `turbo run build` runs in dependency order (shared builds first, apps depend on `^build`). CI is one matrix-free job.
