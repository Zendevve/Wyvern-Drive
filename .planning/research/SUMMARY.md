# Research Summary: Disbox v2

> Research is intentionally **lean** for this project: the user pre-decided the entire stack (see PROJECT.md Key Decisions). This file captures the small set of reference patterns and gotchas that the planning agents need to know.

## Stack decisions (locked)

- **Web**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Zustand
- **Server**: Hono + discord.js-selfbot-v13 + Drizzle ORM + better-sqlite3 + jose (JWT)
- **Extension**: MV3, plain JS, no framework
- **Shared**: TypeScript SDK, esbuild bundle, zero runtime deps in core
- **Monorepo**: pnpm workspaces + Turborepo

## Reference patterns

### Discord chunk upload (from v1 `disbox-file-manager.js`)

- 25 MB chunks sent as webhook message attachments (filename = `prefix_index`, body = `{}`)
- Chunks downloaded by fetching `https://cdn.discordapp.com/attachments/...` URLs
- v1 used webhook URLs as identity (hashed). **v2 uses user tokens + discord.js-selfbot-v13** — chunks become regular user-posted messages in a private server channel.
- CORS bypass that v1 needed (allorigins proxy + extension) is **no longer needed in v2** because the server proxies all Discord traffic. The extension is now a deep-link convenience, not a dependency.

### File tree model (from v1 `disbox-file.js`)

- Single `files` table with `parent_id` for hierarchy
- `{ type: 'directory', children: {} }` node shape
- v2 keeps this shape but splits into `nodes` (folders) and `files` (with chunk refs) for cleaner queries; adds `chunks` table for dedup and `shares` table for shortlinks.

### Encryption prior art (from deleted v2 attempt in git history)

The previous v2 attempt used **Argon2id + AES-GCM** in a Web Worker. v2 keeps this pattern (proven), and the SDK isolates the KDF/crypto from the UI.

## Gotchas surfaced

1. **discord.js-selfbot-v13 is ToS-grey**: the user must accept this. Document in README; do not hide it.
2. **better-sqlite3 is synchronous and single-process**: one Node process only. No cluster, no pm2 cluster mode. Document the constraint.
3. **Discord rate limits**: roughly 5 messages / 5 s per channel, 50 MB / file max. Need a server-side rate-limit-aware queue, not naive per-chunk awaits.
4. **Discord CDN URLs expire**: attachment URLs are signed but stable for the file's lifetime. CDN URLs are public — anyone with the URL can download. This is the basis for the share feature and also the reason E2EE exists.
5. **AES-GCM AAD must include the chunk index** so chunks can't be reordered across files. Use content hash + chunk index + file id as AAD.
6. **WebCrypto subtle is async and worker-only for Argon2id**: do Argon2 in a dedicated Web Worker (e.g. `argon2-browser`); AES-GCM can run on the main thread.
7. **Next.js 14 App Router + Zustand SSR**: Zustand stores must be created per-request on the server; use the `useStore` pattern with `useState(() => createStore())` or `getServerSideProps` boundary.
8. **MV3 service workers can't use IndexedDB transactionally across the message bus**: the extension's deep-link feature only needs a message from content script to background worker to web app via `chrome.tabs.create({ url })` — no DB needed in the extension.

## Implications for Roadmap

- **Phase 1 must produce the SDK first**: web and server both depend on `chunker`, `hasher`, `treeCodec`, `types`. Server Phase 3 cannot start coding upload routes without it.
- **Phase 3 (server) is the riskiest phase**: real Discord API integration, rate limiting, message lifecycle, dedup. Plan extra verification.
- **Phase 4 (web) is the second-riskiest**: real SPA with drag-drop, queue, progress, optimistic UI. Plan UI-contract generation early.
- **Phase 5 (extension) is optional-dependency**: web app must work without it. The extension is a convenience, not a load-bearing component.
- **Phase 6 (E2EE) needs design care**: the master-passphrase UX is the most user-facing security boundary. Plan a UI contract for it.

## File map

- `STACK.md` — not produced (stack is locked in PROJECT.md)
- `FEATURES.md` — not produced (requirements are in REQUIREMENTS.md)
- `ARCHITECTURE.md` — implicit in ROADMAP.md phase structure + PROJECT.md Constraints
- `PITFALLS.md` — captured in "Gotchas" above

---
*Last updated: 2026-06-07*
