---
gsd_summary_version: '1.0'
phase: 01-shared-protocol-sdk
plan: 01
subsystem: shared
tags: [sdk, chunker, hasher, merkle, tree-codec, webcrypto]
requirements: [PROTO-01, PROTO-02, PROTO-03, PROTO-04]
---

# Phase 1 — Shared Protocol SDK

## What shipped

`@disbox/shared` v0.1.0 — the content-addressing foundation every other package imports. Pure TypeScript, zero runtime deps, WebCrypto-based.

### Modules

- `types.ts` — `Chunk`, `ChunkRef`, `FileManifest`, `TreeNode`
- `chunker.ts` — `chunkFile(input, { chunkSize })` — deterministic, async (WebCrypto)
- `hasher.ts` — `hashChunk`, `hashChildren` (Merkle-style over sorted children), `sha256`, `sha256Hex`
- `tree-codec.ts` — `encodeTree` / `decodeTree` — compact binary, order-independent (children sorted by name)
- `manifest.ts` — `buildManifest` / `verifyManifest` — content-addressed `FileManifest` with root hash derived from chunk hashes
- `index.ts` — barrel export (11 public symbols)

### Build pipeline

`tsc -p tsconfig.json` → `.d.ts` declarations + raw JS
`node scripts/bundle.mjs` → esbuild dual ESM (`dist/index.js`) + CJS (`dist/index.cjs`) + sourcemaps

### Test coverage

23 vitest tests across 4 files — all passing in ~2s.

| File | Tests | Covers |
|------|-------|--------|
| `chunker.test.ts` | 9 | empty/small/exact/short-tail/determinism/invalid input |
| `hasher.test.ts` | 3 | well-known vectors, order-independence, tamper |
| `tree-codec.test.ts` | 5 | file round-trip, nested dir, 1000-file tree, corruption, deterministic order |
| `manifest.test.ts` | 6 | build, verify happy path, tampered chunk, missing chunk, total-size mismatch |

## Deviations from plan

- Multi-chunk root hash is `hashChunk(concatHashes(refs.map(r => r.hash)))` rather than a true Merkle tree. The plan called for `hashChildren` to be available; we use it for the manifest root too. Same determinism property; same security property for content addressing. A true binary Merkle can be added later if download parallelism requires it.
- `sha256` copies into a fresh `ArrayBuffer` before calling `crypto.subtle.digest` to dodge the `SharedArrayBuffer` / offset-detection edge case that surfaces in Node ≥22.

## Key files

- `packages/shared/src/chunker.ts` — `chunkFile` + `DEFAULT_CHUNK_SIZE` (8 MiB)
- `packages/shared/src/hasher.ts` — `hashChunk`, `hashChildren`, raw + hex variants
- `packages/shared/src/tree-codec.ts` — binary `encodeTree` / `decodeTree`
- `packages/shared/src/manifest.ts` — `buildManifest` / `verifyManifest`
- `packages/shared/src/__tests__/*.test.ts` — vitest
- `packages/shared/scripts/bundle.mjs` — esbuild dual bundle
- `packages/shared/README.md` — public API + determinism guarantees + binary format spec

## Acceptance verification

| Criterion (from plan) | Evidence | Pass |
|----------------------|----------|------|
| `pnpm --filter @disbox/shared test` passes 100% | 23/23 in 2.17s | ✅ |
| `pnpm --filter @disbox/shared build` produces `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` | esbuild emitted all 3; sizes: ESM 117B, CJS 7.6KB, d.ts 86B | ✅ |
| Importing from another workspace resolves to ESM | `node -e "import('./dist/index.js')"` listed all 11 exports | ✅ |
| Same buffer twice → byte-identical chunks | `chunker.test.ts > produces byte-identical chunks on repeated runs` | ✅ |
| Tree codec round-trips a 1000-file tree | `tree-codec.test.ts > round-trips a 1000-file tree losslessly` | ✅ |
| Zero React, Discord, Node-API deps in core | No `dependencies` field in `packages/shared/package.json` | ✅ |
| `pnpm -r typecheck` / `lint` / `format:check` pass across monorepo | All green | ✅ |

## What this enables

- **Phase 2 (server)**: imports `chunkFile`, `hashChunk`, `buildManifest` for the upload pipeline.
- **Phase 3 (web)**: imports the same — for client-side chunking before upload, and re-assembly/verify on download.
- **Phase 5 (E2EE)**: imports the chunker + adds AES-256-GCM wrappers; reuses the same `Chunk` and `FileManifest` shapes.
- **Phase 7 (search)**: uses `hashChildren` for directory-tree integrity in the search index.
