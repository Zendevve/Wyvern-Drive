# Architecture

## System Overview

Wyvern Drive is a **browser-only** application — no backend server, no database server, no file storage infrastructure beyond Discord's CDN. Every byte of user data is encrypted in the browser before it leaves the device, and the only external dependency is the Discord webhook API.

```
┌────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  React   │  │  Zustand │  │  Indexed │  │  Web       │  │
│  │  UI      │←→│  Stores  │←→│  DB      │  │  Crypto    │  │
│  └──────────┘  └──────────┘  └────────────┘  └────────────┘  │
│        │                                       │             │
│        │          Chunked + Encrypted          │             │
│        └───────────────────────────────────────┘             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (Discord webhook)
                           ▼
              ┌─────────────────────────┐
              │  Discord CDN            │
              │  (25 MB / message)      │
              └─────────────────────────┘
```

---

## Module Map

```
src/
├── App.tsx                    # Root layout (sidebar, top bar, details drawer)
├── main.tsx                   # Vite entry point
├── index.css                  # Tailwind v4 theme + design tokens
│
├── components/                # React components
│   ├── AudioPlayer.tsx        # Floating glassmorphic audio dock
│   ├── DropZone.tsx           # Window-level drag overlay
│   ├── FileBrowser.tsx        # File/folder browser shell
│   ├── FileDetailsDrawer.tsx  # Right-side metadata + sharing panel
│   ├── FileList.tsx           # Grid/list view + folder pills
│   ├── FolderTree.tsx         # Sidebar folder tree
│   ├── PhotoTimeline.tsx      # Google Photos-style gallery
│   ├── SettingsPanel.tsx      # Webhook + theme config
│   ├── ShareModal.tsx         # Legacy share modal (superseded by drawer)
│   ├── VersionHistory.tsx     # Legacy version list
│   └── …                      # Modals, toasts, breadcrumbs, search, etc.
│
├── lib/                       # Core logic
│   ├── chunker.ts             # 8 MB chunk splitting
│   ├── crypto.ts              # AES-256-GCM encrypt/decrypt
│   ├── crypto.worker.ts       # Web Worker for non-blocking crypto
│   ├── db.ts                  # IndexedDB schema (idb)
│   ├── discord.ts             # Discord webhook API client
│   ├── download.ts            # Chunk reassembly + decrypt
│   ├── media.ts               # Blob URL helpers, preview detection
│   ├── rate-limiter.ts        # Backoff and quota tracking
│   ├── sharing.ts             # Share link encode/decode, password verify
│   ├── upload.ts              # Chunked upload pipeline
│   └── versioning.ts          # Version history, restore
│
├── stores/                    # Zustand state
│   ├── auth-store.ts          # Derived encryption key, lock state
│   ├── audio-store.ts         # Current track, playback state
│   ├── file-store.ts          # File records, selected file
│   ├── folder-store.ts        # Folder tree, current folder
│   ├── search-store.ts        # Query and filters
│   ├── share-store.ts         # Active shares
│   ├── theme-store.ts         # Light/dark toggle
│   ├── upload-store.ts        # In-flight uploads + progress
│   └── webhook-store.ts       # Discord webhook URL + status
│
├── hooks/                     # Custom React hooks
├── types/                     # TypeScript type definitions
└── utils/                     # Pure utility functions (format, etc.)
```

---

## Data Flow

### Upload

1. User drops file(s) into the window or the static card (`DropZone.tsx`).
2. `useUploadStore.startUpload()` registers a progress entry.
3. `lib/upload.ts` splits the file into 8 MB chunks (chunk size tunable).
4. For each chunk, `lib/crypto.ts` encrypts with AES-256-GCM using the user-derived key.
5. Encrypted blob is POSTed to the configured Discord webhook (with `?wait=true` to capture the message ID).
6. Chunk metadata (message ID, webhook URL) is stored in IndexedDB.
7. On the final chunk, a `FileRecord` is created with all chunk references and written to the `files` object store.

### Download / Preview

1. `getFile(id)` reads the `FileRecord` from IndexedDB.
2. For each chunk, the Discord CDN URL is fetched (or refreshed from the stored message ID).
3. Encrypted bytes are decrypted with the user's key and reassembled into a single `Blob`.
4. `URL.createObjectURL()` produces a temporary URL for the browser to consume (preview, audio, download).

### Sharing

1. `generateShareLink()` serializes the file key, password salt (if any), and expiry into a URL-safe base64 payload.
2. The link is appended to `window.location.origin + /share/<payload>`.
3. On the receiving end, `ShareAccess` (in `App.tsx`) parses the payload, prompts for password if required, fetches + decrypts the file, and triggers a browser download.

---

## Security Model

- **Key derivation:** PBKDF2 with 600,000 iterations, SHA-256, random 16-byte salt stored in IndexedDB.
- **Encryption:** AES-256-GCM with a fresh 12-byte IV per chunk. The IV is prepended to the ciphertext blob.
- **Authentication:** Vault password is required on every app load. Idle lock re-encrypts in-memory state.
- **No server trust:** Even if Discord's CDN is compromised, chunks are opaque ciphertext. The user-derived key never leaves the browser.
- **Share links:** Embed the file-specific key in the URL fragment. Password protection derives a wrapper key via PBKDF2 from the password.

---

## State Management

All persistent state lives in IndexedDB through the `idb` library. Zustand stores are the in-memory view of that state plus transient UI state (selected file, current folder, theme, search query, upload progress).

Stores communicate by reading each other's state directly — there is no event bus or middleware orchestration. Side effects (file I/O, network) are encapsulated in `lib/`.

---

## Design System

See `docs/GETTING-STARTED.md` and the in-repo `05-UI-SPEC.md` for the full visual contract:

- **Accent:** Signal Orange (`#FF5A00`)
- **Dark background:** Deep Obsidian (`#0A0A0C`)
- **Light background:** Alabaster (`#FAFAFA`)
- **Typography:** Clash Display (headings) + Satoshi (body) via Fontshare
- **Glassmorphism:** `backdrop-filter: blur(12px)` on floating elements
- **Noise texture:** 2% opacity SVG filter on body background

---

## Build & Deploy

Wyvern Drive is a static SPA. The build output is a `dist/` folder that can be served from any static host (GitHub Pages, Cloudflare Pages, S3, etc.). There is no server runtime required.

```bash
npm run build      # TypeScript check + Vite production build → dist/
npm run preview    # Serve dist/ locally for smoke test
```
