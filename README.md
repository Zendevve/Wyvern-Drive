# 🐉 Wyvern Drive

**The definitive Discord-based cloud storage solution.** Unlimited space, zero cost, fully encrypted.

## Features

- 🔒 **Client-side Encryption** — AES-256-GCM, your keys never leave your browser
- 📁 **Full File System** — Folders, drag-and-drop, multi-select, versioning
- 🎬 **Media Streaming** — Preview images, videos, audio with persistent player
- ⚡ **Performance Optimized** — Dynamic chunking, parallel uploads, virtual grid
- 🔗 **Secure Sharing** — Password-protected, time-limited share links
- 🌙 **Modern UI** — Discord-inspired dark theme, mobile responsive

## Quick Start

```bash
# 1. Install the browser extension (required for downloads)
# Load unpacked extension from wyvern-extension/

# 2. Run the web client
cd wyvern-web && npm install && npm run dev
```

## Architecture

```
📁 Wyvern Drive/
├── wyvern-web/        # React + TypeScript frontend
├── wyvern-extension/  # Chrome extension (CORS bypass)
├── supabase/          # Edge Functions + DB migrations
└── docs/              # Documentation
```

| Component | Purpose |
|-----------|---------|
| **Frontend** | React 18 + Vite, deployed on Netlify |
| **Backend** | Supabase Edge Functions (Deno) |
| **Database** | Supabase PostgreSQL |
| **Storage** | Discord CDN via webhooks |
| **Extension** | Fetch Discord CDN bypassing CORS |

## License

MIT

