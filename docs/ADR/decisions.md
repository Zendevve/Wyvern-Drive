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
