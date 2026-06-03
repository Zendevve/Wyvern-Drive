# Stack Research: Wyvern Drive

## Frontend Framework
**Recommendation:** Vite 6 + React 19 (NOT Next.js)
**Rationale:** Wyvern Drive is a client-only app with no server-side rendering, no API routes, and no backend. Next.js adds unnecessary complexity (server components, route handlers, build overhead) for a static SPA. Vite provides instant HMR, native ESM dev server, and `output: 'static'` export without the Next.js baggage. React 19 gives us concurrent features, `use()` hook, and Server Components-ready patterns even though we won't use them.
**Confidence:** high
**Alternatives considered:**
- Next.js 16 (v16.2.7): Overkill for a pure client-side app. Server components, App Router, and build pipeline add weight with zero benefit. The `output: 'export'` static mode works but fights the framework's design.
- Svelte 5 / Solid: Smaller bundles but smaller ecosystem for the specific patterns needed (virtual scrolling, crypto wrappers, PWA tooling). React's ecosystem dominance wins for this use case.

## Client-Side Encryption
**Recommendation:** Native Web Crypto API (no libraries)
**Rationale:** The Web Crypto API (`window.crypto.subtle`) supports AES-256-GCM natively with hardware acceleration. It's a W3C standard available in all modern browsers since 2015, works in Web Workers, and requires zero dependencies. `crypto-js` is deprecated/unmaintained and uses JavaScript-based crypto (slower, no hardware acceleration). For key derivation from a passphrase, use PBKDF2 via `SubtleCrypto.deriveKey()`. Store the derived key in memory only—never persist encryption keys.
**Confidence:** high
**Alternatives considered:**
- `crypto-js` (v4.2.0): Deprecated, no longer maintained. Uses JS-based AES (no WebCrypto hardware acceleration). Security audit concerns.
- `@noble/ciphers`: Excellent library but unnecessary when Web Crypto handles AES-256-GCM natively. Only consider if you need algorithms Web Crypto doesn't support (XChaCha20, etc.).
- `sjcl`: Stanford JavaScript Crypto Library. Obsolete, last update years ago.

## Browser Storage (Metadata)
**Recommendation:** IndexedDB via `idb` (v8) wrapper
**Rationale:** IndexedDB is the only browser storage with enough capacity for 10K+ file metadata records. The `idb` library (by Jake Archibald, 150KB+ weekly downloads) provides a clean Promise-based API over the verbose IndexedDB interface, with TypeScript support and transaction helpers. For the schema: store files in an object store with indexes on `parentId`, `name`, `mimeType`, `createdAt`. Use a separate store for folder hierarchy. Keep encryption keys in memory only (derive on unlock).
**Confidence:** high
**Alternatives considered:**
- Raw IndexedDB: Verbose callback-based API. `idb` wraps it cleanly with zero overhead.
- `localForage`: Adds IndexedDB/WebSQL/LocalStorage abstraction. We don't need WebSQL/LocalStorage fallback—IndexedDB alone is sufficient for modern browsers.
- `Dexie.js`: Full IndexedDB wrapper with query builder. More features than needed; `idb` is simpler and lighter.
- localStorage/sessionStorage: 5-10MB limit. Cannot handle 10K+ file records.

## Virtual Scrolling
**Recommendation:** TanStack Virtual v3 (`@tanstack/react-virtual`)
**Rationale:** TanStack Virtual v3 is the current standard for virtualization. Framework-agnostic core, ~4KB gzipped, supports variable row heights (critical for file lists with thumbnails/previews), and handles 100K+ items smoothly. The `useVirtualizer` hook integrates cleanly with React. Supports both fixed and variable item sizes.
**Confidence:** high
**Alternatives considered:**
- `react-window` (v1.8.x): Maintained but aging. Fixed row height requirement makes it unsuitable for file lists with mixed content. TanStack Virtual supersedes it.
- `react-virtuoso` (v4.x): Good alternative, slightly larger bundle. TanStack Virtual has better docs and broader adoption in 2025.
- `@tanstack/react-table` virtualization: Already included if using TanStack Table, but we need standalone virtualization for a custom file list.

## File Chunking & Parallel Upload
**Recommendation:** Custom implementation using `File.slice()` + `Promise.all` with concurrency limiter
**Rationale:** Discord webhook file upload limit is 25MB. Files larger than 25MB (after encryption, ciphertext is slightly larger) must be chunked. Use `File.slice(start, end)` to split into chunks, encrypt each chunk independently with AES-256-GCM (each chunk gets its own IV/nonce), then upload sequentially or with limited parallelism (3-5 concurrent uploads to avoid Discord rate limits). No library needed—this is ~100 lines of code. Store chunk metadata in IndexedDB (chunk index, message ID per chunk, byte ranges).
**Confidence:** high
**Alternatives considered:**
- `tus-js-client`: Resumable upload protocol. Overkill—Discord webhooks don't support tus protocol.
- `axios` chunked upload: Axios doesn't natively handle file chunking. Still need `File.slice()`.
- `p-queue`: Use for concurrency limiting if custom implementation gets complex. But a simple semaphore pattern works.

## PWA Support
**Recommendation:** `vite-plugin-pwa` v1.3 (with Workbox)
**Rationale:** The standard PWA solution for Vite projects. Zero-config defaults, generates service worker with Workbox, handles precaching of static assets, offline support, and install prompts. Generates the web app manifest automatically. Supports `prompt` or `autoUpdate` strategies. For Wyvern Drive: use `prompt` strategy so users control when to update. Configure offline caching for the app shell and static assets (but NOT for Discord API calls—those need network).
**Confidence:** high
**Alternatives considered:**
- Next.js PWA (manual `sw.js`): Next.js has PWA docs but requires manual service worker creation. `vite-plugin-pwa` is zero-config.
- `serwist`: Newer Workbox replacement. Less mature than Workbox. Consider for future migration.
- Manual service worker: Too much maintenance. Workbox handles cache invalidation, update flows, and browser compatibility.

## UI/Styling
**Recommendation:** Tailwind CSS v4 + shadcn/ui + Radix UI primitives
**Rationale:** Tailwind CSS v4 (current: 4.x) with the new Oxide engine for faster builds. shadcn/ui provides copy-paste components built on Radix UI primitives—perfect for a Discord-inspired dark theme because you own the component code (not locked into a library). Radix provides accessible, unstyled primitives (Dialog, DropdownMenu, ContextMenu, Tooltip) that handle keyboard navigation, focus management, and ARIA attributes. For the Discord aesthetic: custom dark color palette with `#5865F2` (Discord blurple), `#2C2F33` (dark background), `#23272A` (darker panels).
**Confidence:** high
**Alternatives considered:**
- `chakra-ui`: Larger bundle, more opinionated styling. Less control for a Discord-inspired custom theme.
- `MUI` (Material UI): Material Design aesthetic conflicts with Discord's custom design language.
- Plain CSS Modules: No design system, no component library. Too much manual work for accessible components.

## Testing
**Recommendation:** Vitest v4.1 + Playwright v1.50 + MSW v2
**Rationale:**
- **Vitest v4.1**: Unit/integration tests. Native Vite integration, ESM-first, TypeScript out of the box. 64M+ weekly downloads. Use `vitest-browser-mode` for testing Web Crypto API and IndexedDB in real browser context.
- **Playwright v1.50**: E2E tests. Cross-browser (Chromium, Firefox, WebKit). Use for testing file upload flow, chunking, Discord webhook integration (with MSW mocking).
- **MSW v2 (Mock Service Worker)**: Intercept Discord webhook API calls in both unit and E2E tests. No need for a real Discord server during testing. MSW intercepts at the network level, so your code runs unmodified.
**Confidence:** high
**Alternatives considered:**
- Jest: Slower than Vitest, ESM support is painful, no native Vite integration. Vitest is the clear successor.
- Cypress: Good E2E but Playwright has better cross-browser support, faster execution, and native test isolation.
- `nock`: HTTP mocking at the Node.js level. MSW works in both browser and Node, making it more versatile.

## What NOT to Use
- **crypto-js**: Deprecated, unmaintained, JavaScript-based crypto (no hardware acceleration). Use native Web Crypto API.
- **Next.js**: Overkill for a client-only static SPA. Server components, App Router, and build pipeline add unnecessary complexity.
- **react-window**: Fixed row heights only. TanStack Virtual v3 supersedes it.
- **localStorage for metadata**: 5-10MB limit. Cannot handle 10K+ file records with folder hierarchy.
- **firebase/localforage**: Adds unnecessary abstraction layers. IndexedDB via `idb` is sufficient.
- **Create React App (CRA)**: Officially deprecated. Use Vite.

## Summary

Wyvern Drive should use **Vite 6 + React 19** as the build framework (not Next.js—there's no server), **native Web Crypto API** for AES-256-GCM encryption (no libraries needed), **IndexedDB via `idb`** for metadata storage, **TanStack Virtual v3** for 10K+ item lists, **custom `File.slice()` chunking** for Discord's 25MB limit, **`vite-plugin-pwa`** for PWA/service worker support, **Tailwind CSS v4 + shadcn/ui** for the Discord-inspired dark UI, and **Vitest + Playwright + MSW** for testing. This stack is minimal, dependency-light, and purpose-built for a client-only encrypted storage app with no backend server.
