# Wyvern Drive

> Self-hosted, browser-based cloud storage powered by Discord webhooks. Zero cost. Unlimited storage. Client-side AES-256-GCM encryption — keys never leave the browser.

---

## Overview

Wyvern Drive transforms Discord webhooks into a free, unlimited file storage backend. Files are encrypted in-browser before upload, chunked to respect Discord's 25 MB webhook limit, and streamed back on demand through Discord's CDN. File metadata, folder structure, and version history live in IndexedDB.

**Core value:** Files stored securely via Discord CDN — zero cost, unlimited, encrypted.

---

## Features

- **Client-side encryption** — AES-256-GCM via the Web Crypto API; PBKDF2 key derivation (600K iterations, OWASP 2023)
- **Chunked uploads** — 8 MB default chunks, parallel transfer with rate-limit backoff
- **Folder system** — nested folders, drag-and-drop organization
- **File versioning** — full version history with one-click restore
- **Secure sharing** — password-protected, time-limited share links
- **Media streaming** — in-browser preview for images, video, and audio
- **Persistent audio player** — floating glassmorphic dock, continuous playback across navigation
- **Photo timeline** — Google Photos-style chronological gallery
- **Grid / List views** — toggleable file browser with inline folder pills
- **Right-side details drawer** — file metadata, version history, and sharing config
- **Fullscreen drag overlay** — window-level drop zone with glassmorphic backdrop
- **Dual light/dark theme** — Signal Orange accent, Clash Display + Satoshi typography
- **PWA-ready** — installable on mobile and desktop

---

## Quick Start

```bash
npm install
npm run dev
```

Open the app, configure a Discord webhook URL in **Settings**, set a vault password, and start uploading.

See [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) for the full walkthrough.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) | Installation, first-time setup, Discord webhook configuration |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data flow, module map |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev workflow, build commands, code conventions |
| [docs/TESTING.md](docs/TESTING.md) | Unit and E2E test strategy, running tests |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Environment variables, theme tokens, build options |

---

## Tech Stack

- **Build:** Vite 6 + TypeScript 5.7
- **UI:** React 19 + Tailwind CSS v4
- **State:** Zustand 5
- **Storage:** IndexedDB (via `idb`)
- **Encryption:** Web Crypto API (AES-256-GCM, PBKDF2)
- **Components:** Radix UI primitives
- **Tests:** Vitest 4 + Playwright 1.60

---

## License

Private / unreleased. See repository owner for licensing terms.
