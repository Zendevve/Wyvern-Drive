# Phase 9: Encryption at Rest (secrets never leak) — Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — ROADMAP phase goal is the spec; autonomous run)

<domain>
## Phase Boundary

User files, share payloads, and webhook secrets are protected by AES-256-GCM with Argon2id-derived keys; no plaintext secret ever touches IndexedDB, DevTools, or a backup export.

This phase delivers the cryptographic spine of v3.0. The encryption engine is browser-native (`crypto.subtle`), key derivation runs in a Web Worker to keep the main thread responsive, and the master-password-gated secret store replaces plaintext credential persistence. The existing v1.0 webhook-based auth (and the JWT it issues) is preserved — encryption is a layer on top, not a replacement.

Out of scope (later phases): persistent operation queue with crash recovery (Phase 10), disaster-recovery backup export/import (Phase 11), observability + destructive consent gate (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Locked (from ROADMAP.md)

- **CRYPTO-01**: AES-256-GCM encryption at rest. Per-chunk 12-byte nonce + 16-byte auth tag. On-chunk layout: `nonce(12) ‖ tag(16) ‖ ciphertext` — self-describing, fails closed on tamper.
- **CRYPTO-02**: Shareable encrypted archive. `.wyvern-share.zip` containing manifest + encrypted chunks + Argon2id-derived key hint; recipient opens in Wyvern Drive and supplies the passphrase out-of-band.
- **CRYPTO-03**: Webhook URL and OAuth tokens encrypted with KEK before write to IndexedDB. DevTools storage tab shows ciphertext only.
- **CRYPTO-04**: Key zeroization on logout — every `CryptoKey` reference is overwritten, the worker is terminated, the next session re-derives from scratch.
- **AAD**: `SHA-256(fileId || chunkIndex)` per chunk — prevents swap attacks where an attacker moves a chunk between files.
- **Argon2id parameters**: `m=64MB, t=3, p=4` — derivation target 1–3 s on a low-end laptop.

### the agent's Discretion

- **Crypto engine location**: `web/src/lib/crypto.ts` (the existing file holding `deriveAccountId`) is expanded. New exports: `encryptChunk`, `decryptChunk`, `deriveKeyArgon2id`, `MasterPasswordGate`, `SecretStore`, `wrapDek`, `unwrapDek`, plus types. ~400–500 lines.
- **Argon2id library**: Use `argon2-browser` (WASM) — no native build needed, runs in Web Worker. Falls back to `PBKDF2-SHA-256 (310,000 iterations)` if WASM unavailable, with a `used_fallback_kdf: true` flag stored in the manifest. (Native `argon2` npm would require N-API rebuild for the server-side test harness; the pure-WASM browser path is the right default for a browser-only product.)
- **Key storage**: Master KEK lives in a `CryptoKey` (non-extractable) in a dedicated `web/src/workers/crypto.worker.ts` Worker. The worker exposes `encryptChunk`/`decryptChunk` via `postMessage`; the `CryptoKey` never leaves the worker. Session-only — killed on logout.
- **Per-file DEK**: 256-bit random, generated per file when encryption is enabled. DEK is wrapped with the KEK using AES-KW (AES-256-GCM would be AEAD on a key — AES-KW is the standard key-wrapping primitive for this). Wrapped DEK stored in the file's metadata row.
- **SecretStore shape**: Single `secret_store` IndexedDB object store. Value: `{ id: 'main', ciphertext: ArrayBuffer, iv: ArrayBuffer, kdf: 'argon2id', kdfParams: {m,t,p,salt} }`. Master-password-gated; the wrapped webhook URL is the only entry. No plaintext `webhookUrl` field anywhere in storage after `setMasterPassword()` is called.
- **Migration**: When a user sets a master password for the first time, the existing plaintext webhook URL in `localStorage` (per `web/src/lib/storage.ts`) is moved into the encrypted `secret_store` and the plaintext is wiped. JWT in localStorage stays as-is — the JWT is the auth credential, not the secret; the webhook is the secret.
- **Per-file encryption toggle**: New checkbox in the upload dialog (`<input type="checkbox" id="encrypt">`). When checked, the upload dialog prompts for a per-file passphrase (used to derive the DEK via Argon2id with a per-file salt) OR (if no passphrase supplied) uses the master KEK to wrap the DEK. The "share" vs "private" distinction is captured in the file metadata: `encrypted_with: 'master' | 'passphrase' | null`.
- **Encrypted share archive**: `JSZip` (already a transitive of nothing — add as new dep) builds the `.wyvern-share.zip`. Manifest: `{ format_version: 1, file: { name, size, mime, chunks: [{ index, nonce, tag, ciphertext_offset }] }, encryption: { kdf: 'argon2id', params, salt, kdf_hint } }`. The recipient opens Wyvern Drive, drags the zip into the "Import Share" dropzone, supplies the passphrase, the SPA decrypts and writes to local VFS.
- **Master password UI**: A `MasterPasswordGate` modal blocks the app on first launch of a session when no master password is set — collects password + confirm. On subsequent sessions, a `MasterPasswordUnlock` modal prompts for the password. After 5 failed attempts the local store is wiped (defense against offline brute force on a stolen device).
- **Key zeroization protocol**:
  1. `useAuthStore.logout()` (existing) is extended to call `cryptoWorker.terminate()`.
  2. New session: re-spawn worker, re-derive KEK from user-supplied master password.
  3. If the user never set a master password, the "session" operates in **plaintext mode** (current behavior) — webhook URL in localStorage, JWT in localStorage. The MasterPasswordGate is opt-in: there's a "Skip — use session-only auth" button. This keeps v1.0/v2.0 users unbroken.
- **Audit integration**: Login / logout / set-master-password / unlock / failed-unlock events are audited via the existing `withAudit` helper from Phase 7. New audit action types: `master_password_set`, `master_password_unlock`, `master_password_unlock_failed`, `file_encrypted`, `file_decrypted`, `share_archive_created`, `share_archive_imported`.
- **Crypto test harness**: Vitest tests in `web/src/lib/__tests__/crypto.test.ts` cover: known-vector AES-GCM round-trip, swap-attack detection (AAD with chunk index), tamper-detection (one-byte flip in ciphertext → `OperationError`), Argon2id parameter validation, DEK wrap/unwrap round-trip, and the SecretStore encryption-at-rest invariant (asserting that the stored `ciphertext` byte length is not equal to the input length — i.e. encryption actually happened).
- **Performance**: Argon2id runs in a Worker so the main thread stays responsive. UI shows a "Deriving key…" progress bar with a `setInterval` tick — UX-wise this is critical because users will see 1–3 s of "loading" the first time.

### Out of scope (deferred to v3.1+)

- Per-file encryption toggle for downloads (the download path is symmetric — decrypt is the inverse of encrypt — so this is automatic once encrypt is wired).
- Server-side share-link revocation list (Phase 11 owns integrity + receipts).
- Content-addressed dedup (encrypted chunks are unique per DEK — dedup would need homomorphic tricks, deferred to v4).
- End-to-end encryption where the server never sees the DEK (conflicts with the per-user-webhook model; not planned).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `web/src/lib/crypto.ts` — currently holds only `deriveAccountId(webhookUrl): Promise<string>`. Will be expanded with the full crypto engine.
- `web/src/lib/storage.ts` — `readJwt/writeJwt/clearJwt` helpers. Master password status (set / not-set) will live in a new `MasterPasswordStatus` IndexedDB row in the new `secret_store`.
- `web/src/lib/auditMiddleware.ts` — `withAudit(correlationId, opts, fn)` wraps state-changing operations. All new crypto operations compose with this.
- `web/src/hooks/useUploader.ts` — existing single-POST uploader. Per-file encryption is added as an opt-in transform that wraps the chunk *after* client-side chunking and *before* the XHR upload. The server is unchanged.
- `web/src/store/auth.ts` — `useAuthStore.login/logout/restore` extended with master-password state.
- `web/src/api/uploadResumable.ts` — resumable uploader (Phase 8) reused as-is. Encryption happens transparently inside the chunk payload.
- `src/services/discord.ts` — server-side. No changes needed for Phase 9. Encrypted bytes are opaque to the server.

### Established Patterns

- **TypeScript strict mode**, ESM, vitest for tests. `web/src/lib/__tests__/` for unit tests, `web/src/__tests__/` for component tests.
- **Audit-everything** — every state-changing op is wrapped with `withAudit`. New crypto ops follow this pattern.
- **IndexedDB** — used in Phase 7 for `audit_log`. New `secret_store` follows the same pattern (single object store, versioned via `onupgradeneeded`).
- **Plain UI components** — `Modal`, `Button`, `Toast` (Phase 4) reused for the MasterPasswordGate modal. No new UI library needed.
- **Zustand stores** — `useAuthStore` extended; no new top-level store needed for the master password state.

### Integration Points

- `web/src/App.tsx` — wraps the app in a `MasterPasswordGate` boundary that prompts on session start if a master password is set.
- `web/src/pages/AuthPage.tsx` — login flow extended with a "Set master password" checkbox.
- `web/src/components/DropZone.tsx` — upload dialog extended with the per-file encryption toggle.
- `web/src/components/Sidebar/Sidebar.tsx` — new "Import Encrypted Share" entry next to the Activity link.
- `web/src/lib/api.ts` — `setUnauthorizedHandler` already triggers `useAuthStore.logout()`; Phase 9 extends logout to terminate the crypto worker.

### Codebase Map Status

No existing `.planning/codebase/` maps. Codebase structure is small enough (~20 web files, ~16 server files) to scout inline. All reuse paths documented above.

</code_context>

<specifics>
## Specific Ideas

- Argon2id params: `m=64MB, t=3, p=4` — locked from ROADMAP.
- Crypto test vectors: use the Wycheproof test vectors for AES-GCM if available, otherwise the NIST CAVP vectors. The test harness covers known-answer, tamper, and swap cases.
- UI copy: master-password prompts should use the word "passphrase" (not "password") — matches the offline-bruteforce threat model and signals that longer is better.
- First-launch onboarding: a one-time tooltip near the master-password field explaining "This protects your webhook URL. If you lose it, your files in Discord become inaccessible." Mirrors the threat model honestly.

</specifics>

<deferred>
## Deferred Ideas

- Server-side share-link revocation (CRYPTO-04 in v2.0 docs, but the v3 ROADMAP's CRYPTO-04 is *key zeroization* — defer any share-revocation to v3.1).
- PBKDF2 fallback path for non-WASM environments — the fallback is implemented (per agent discretion above) but the *test coverage* of the fallback is a v3.1 concern.
- Hardware-bound keys (`crypto.subtle` doesn't yet support `KeySource.hardware` widely; defer to v4).
- Per-folder encryption policies (encrypt everything in folder X) — v3.1.
- Encrypted search (encrypted indexes for searching encrypted files) — research-y, v4+.
- Sharing without the user opening Wyvern Drive (e.g. an HTML page that decrypts the share in the browser) — v4.
- Biometric unlock (WebAuthn) for the master password — v3.1.

</deferred>
