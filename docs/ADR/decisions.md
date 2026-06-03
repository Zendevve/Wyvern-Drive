# ADR-001: Tech Stack Choice

**Status:** Proposed
**Date:** 2025-12-12

## Context
Building Wyvern Drive as an improved Disbox. Need modern, maintainable stack.

## Decision

### Web Client
- **Vite + React 18 + TypeScript** (vs CRA in Disbox)
- Zustand for state (simpler than Recoil)
- Framer Motion for animations

### Server
- **Express + TypeScript** (vs plain JS in Disbox)
- SQLite with better-sqlite3 (sync, faster)

### Extension
- Manifest V3 (Chrome requirement)

## Consequences
- ✅ Better DX with Vite hot reload
- ✅ Type safety catches bugs early
- ✅ Modern React 18 features (Suspense, transitions)
- ⚠️ Team needs TypeScript knowledge

---

# ADR-002: Client-Side Encryption

**Status:** Proposed
**Date:** 2025-12-12

## Context
Users want privacy. Server should never see plaintext.

## Decision
- Use Web Crypto API (AES-256-GCM)
- Derive key from user password using PBKDF2
- Encrypt each chunk before upload
- Store IV per-file in metadata

## Consequences
- ✅ Zero-knowledge server
- ✅ No external crypto dependencies
- ⚠️ Lost password = lost data (no recovery)
- ⚠️ Cannot search encrypted filenames on server

---

# ADR-003: Chunk Size Strategy

**Status:** Proposed
**Date:** 2025-12-12

## Context
Discord free: 25MB limit. Nitro: 50MB+ limit.

## Decision
- Default: 25MB chunks (works for everyone)
- Auto-detect Nitro: try 50MB, fallback to 25MB on error
- User override in settings

## Consequences
- ✅ Works for all users
- ✅ Faster uploads for Nitro users
- ⚠️ Detection adds complexity

---

# ADR-004: Fully Local Self-Hosted Architecture

**Status:** Accepted
**Date:** 2026-06-03

## Context
The system originally had a dependency on Supabase Cloud for user authentication, webhook URL persistence, and global user profiles. To achieve a zero-cloud-dependency, completely self-hosted local setup, we needed to move all database and authentication capabilities to the local Express/SQLite server and remove the Supabase Cloud requirement.

## Decision
- Implement local authentication endpoints (`/api/auth/signup`, `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`) on the Express backend, backed by SQLite `users` table and secure password hashing (argon2).
- Replicate profile storage on the Express backend with `/api/profiles/:id` endpoint for webhook URLs and settings persistence.
- Replicate Supabase share metadata tables on SQLite and implement share creation/fetch endpoints on the local backend.
- Replace Supabase React UI dependencies (`@supabase/auth-ui-react`, `@supabase/auth-ui-shared`) in the frontend with a custom, highly polished, premium, and fully accessible AuthScreen component.
- Implement a mock client-side adapter in `wyvern-web/src/lib/supabase.ts` that redirects authentication, profiling, and state management requests to the local Express server, preserving the rest of the frontend file logic.
- Add a concurrent dev script manager (`dev.js`) to launch both components concurrently from the root directory.

## Consequences
- ✅ 100% self-hosted, cloud-independent local operation.
- ✅ Custom accessible AuthScreen matching our "Linear" design system aesthetics.
- ✅ Full test suite for both local backend SQLite/routes and frontend fileStore selection logic.
- ⚠️ Authentication tokens are signed locally; local server must remain running to service active sessions.
