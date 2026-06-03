# Wyvern Drive — Project Guide

## What This Is

Discord-based cloud storage with unlimited space, zero cost, and client-side encryption. Self-hosted PWA — no backend server.

## Quick Start

1. Configure Discord webhook URL in `.env` or settings UI
2. Run `npm install && npm run dev`
3. Upload files — they encrypt, chunk, and store via Discord

## Architecture

- **Client-only** — no backend server, everything runs in browser
- **Storage:** Discord webhooks → Discord CDN
- **Encryption:** AES-256-GCM via Web Crypto API
- **Metadata:** IndexedDB (file records, folders, versions)
- **Stack:** Vite 6 + React 19 + Tailwind CSS v4 + shadcn/ui

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run E2E tests (Playwright)
```

## Project Structure

```
src/
├── components/      # React components
├── lib/             # Core logic (encryption, storage, discord)
├── hooks/           # React hooks
├── stores/          # State management
├── types/           # TypeScript types
└── utils/           # Utility functions
```

## GSD Workflow

This project uses the GSD (Get Shit Done) workflow for planning and execution.

- **Current phase:** Phase 1 — Core Storage Engine
- **Next action:** `/gsd-plan-phase 1` to plan Phase 1 execution
- **Progress:** `/gsd-progress` to check status

## Critical Notes

- Discord default upload limit is **10MB** (25MB requires Nitro)
- CDN URLs expire — always store message IDs for refresh
- PBKDF2 must use 600K iterations (OWASP 2023)
- Webhook execute needs `?wait=true` for message response
- Rate limits: 50 req/sec global — implement backoff
