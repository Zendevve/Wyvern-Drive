# Technology Stack

**Analysis Date:** 2026-06-03

## Languages

**Primary:**
- TypeScript ~5.6.2 - Used in `wyvern-web/src` for all React frontend application code, types, and logic.
- TypeScript - Used in `supabase/functions/api/index.ts` for backend API and orchestration logic.

**Secondary:**
- JavaScript (Vanilla ES6) - Used in `wyvern-extension` for the Chrome Extension background and content scripts (`background.js`, `content.js`).
- CSS (Vanilla CSS / Custom Properties) - Used throughout `wyvern-web/src/styles` and components for interface styling.
- SQL - Used in `supabase/migrations` for database schema definitions.

## Runtime

**Environment:**
- Node.js 20.x (LTS) - For local dev and builds.
- Web Browser - React app execution environment.
- Chrome Extension (Manifest V3) - Extension execution environment.
- Deno Runtime - Supabase Edge Functions execution environment.

**Package Manager:**
- npm 10.x - Package manager for the project.
- Lockfile: `package-lock.json` present in the workspace root.

## Frameworks

**Core:**
- React 18.3.1 - Frontend UI library (`wyvern-web/src`).
- React Router DOM 7.10.1 - Frontend routing client (`wyvern-web/src/App.tsx`).
- Supabase (Backend-as-a-Service) - Multi-tenant backend, authentication, database, and serverless edge functions.

**Testing:**
- Vitest 2.1.8 - Unit testing runner (`wyvern-web/package.json`).

**Build/Dev:**
- Vite 6.0.3 - Bundling, HMR, and development server.
- TypeScript Compiler (tsc) - Static typing check.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.87.1 - Supabase Client SDK for database operations, storage, and authentication.
- `zustand` ^5.0.2 - Lightweight client state management (`wyvern-web/src/stores/fileStore.ts`).
- `idb` ^8.0.3 - IndexedDB interface wrapper for caching encrypted file metadata locally.
- `framer-motion` ^11.13.3 - Production-ready motion and UI animations.
- `lucide-react` ^0.561.0 - SVG icon pack.

**Infrastructure/Utilities:**
- `pako` ^2.1.0 - Zlib compression library for handling chunked file data.
- `jszip` ^3.10.1 - Dynamic client-side ZIP archive builder.
- `exifr` ^7.1.3 - Dynamic EXIF data extractor for local photo/media information.
- `fuse.js` ^7.1.0 - Client-side fuzzy search client.

## Configuration

**Environment:**
- Configured via `.env` and `.env.local` files in `wyvern-web/`.
- Required keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DISCORD_CLIENT_ID`.

**Build:**
- `wyvern-web/vite.config.ts` - Vite server and asset compiler setup.
- `wyvern-web/tsconfig.json` - Frontend compile configurations.
- `supabase/config.toml` - Supabase project config.
- `netlify.toml` - Netlify deployment settings and headers.

## Platform Requirements

**Development:**
- Windows/macOS/Linux with Node.js LTS and Git.
- Supabase CLI installed locally for database migrations.

**Production:**
- Frontend: Netlify static hosting.
- Backend: Supabase project (PostgreSQL + Auth + Edge Functions).
- Extension: Google Chrome Web Store (MV3 extension).

---

*Stack analysis: 2026-06-03*
*Update after major dependency changes*
