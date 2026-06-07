# Disbox v2

**Discord-as-cloud-storage.** A self-hostable web app that turns a user's own Discord account into unlimited personal cloud storage.

> ⚠ **Heads up:** This project uses `discord.js-selfbot-v13`, which is a self-bot library. Using a self-bot violates Discord's Terms of Service and may result in account termination. This software is for personal experimentation only. The authors are not responsible for any account actions taken by Discord.

## What's in this repo

```
.
├── apps/
│   ├── web/       — Next.js 14 + shadcn/ui + Zustand file manager
│   ├── server/    — Hono + discord.js-selfbot-v13 + Drizzle + better-sqlite3
│   └── ext/       — MV3 Chrome extension (deep-link convenience)
├── packages/
│   └── shared/    — Protocol SDK (chunker, hasher, tree codec, types)
├── .planning/     — GSD project artifacts (PROJECT, ROADMAP, REQUIREMENTS, STATE)
└── extension/, server/, web/   — v1 reference (untracked; remove after v2 ships)
```

## Quick start

```bash
pnpm install
pnpm -r build
pnpm dev
```

## Project status

See `.planning/ROADMAP.md` for the 11-phase build plan. See `.planning/PROJECT.md` for context and key decisions.

## License

TBD (v1 was MIT; v2 will pick a compatible OSS license at milestone close).
