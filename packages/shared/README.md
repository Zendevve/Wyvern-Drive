# @disbox/shared
- **Version:** 0.1.0
- **Runtime:** Browser + Node 20+ (WebCrypto required)
- **Bundle:** Dual ESM (`dist/index.js`) + CJS (`dist/index.cjs`) + `.d.ts`
- **Dependencies:** Zero runtime deps. Uses `crypto.subtle` directly.

## Public API

```ts
import {
  chunkFile,        // (bytes, { chunkSize }) => Chunk[]
  hashChunk,        // (bytes) => hex SHA-256
  hashChildren,     // ([{name, hash}]) => hex SHA-256 of sorted concatenated hashes
  sha256, sha256Hex,// raw + hex variants
  encodeTree,       // (TreeNode) => Uint8Array
  decodeTree,       // (Uint8Array) => TreeNode
  buildManifest,    // ({ path, mime, chunks }) => FileManifest
  verifyManifest,   // (manifest, chunks) => { ok, reason? }
  DEFAULT_CHUNK_SIZE, // 8 MiB
  SHARED_SDK_VERSION, // 0.1.0
} from '@disbox/shared';
```

## Determinism guarantees

- `chunkFile(b, opts)` produces identical chunks across runs, browsers, and Node versions.
- `hashChildren` is order-independent (sorts by name first).
- `encodeTree` is order-independent (sorts children by name first).
- The root manifest id equals the SHA-256 of the file (single chunk: chunk hash; multi-chunk: hash of concatenated chunk hashes).

## Tree codec binary format

```
node         := type(1) name_len(4 BE) name(name_len) hash(32) size(8 BE) [child_count(4 BE) node*]
type         := 0 (file) | 1 (directory)
```

Children of every directory are sorted by name before encoding so the output is stable regardless of insertion order.

## Edge cases handled

- Empty input → single empty chunk
- Input smaller than `chunkSize` → single chunk
- Exact multiple of `chunkSize` → no short tail
- Hashing empty bytes → `e3b0c4…2b855` (well-known empty SHA-256)

## Test coverage (23 tests, all passing in ~2s)

- `chunker.test.ts` — 9 tests: small/empty/exact/short-tail/determinism/edge cases
- `hasher.test.ts` — 3 tests: well-known vectors + order-independence
- `tree-codec.test.ts` — 5 tests: round-trip (file, dir, 1000-file tree, corruption, deterministic order)
- `manifest.test.ts` — 6 tests: build/verify happy path + tamper + missing chunk

## Build

```bash
pnpm --filter @disbox/shared build
# → tsc emits .d.ts + .js
# → esbuild emits dist/index.js (ESM) + dist/index.cjs (CJS) + sourcemaps
```
