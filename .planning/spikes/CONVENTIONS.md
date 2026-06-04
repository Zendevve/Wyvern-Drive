# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these unless the question requires otherwise.

## Stack
- Frontend: Vite + React 19 + Tailwind CSS v4 + TypeScript (matching Wyvern Drive)
- Backend: None (Wyvern Drive is self-hosted client-only)

## Structure
- Spikes are stored in `.planning/spikes/NNN-name/`
- Findings are documented in `README.md` in each spike directory.

## Patterns
- Local metadata store: IndexedDB
- File storage backend: Discord CDN via Webhooks
- File chunking: 10MB - 25MB
- Encryption: client-side AES-256-GCM via Web Crypto API
