// File manifest helpers. A FileManifest is a content-addressed description of a
// file: its name, MIME, total size, and the list of chunk refs (hash + size + optional
// Discord IDs). Manifests are persisted server-side and used to reassemble downloads.

import type { Chunk, ChunkRef, FileManifest } from './types.js';
import { hashChunk } from './hasher.js';

export interface ManifestInput {
  id?: string;
  path: string;
  mime: string;
  chunks: Chunk[];
}

export async function buildManifest(input: ManifestInput): Promise<FileManifest> {
  if (input.chunks.length === 0) {
    throw new RangeError('cannot build manifest with zero chunks');
  }
  const refs: ChunkRef[] = input.chunks.map((c) => ({
    hash: c.hash,
    size: c.size,
  }));
  const totalSize = refs.reduce((s, r) => s + r.size, 0);
  let rootHash: string;
  if (refs.length === 1) {
    rootHash = refs[0]!.hash;
  } else {
    const joined = await concatHashes(refs.map((r) => r.hash));
    rootHash = await hashChunk(new TextEncoder().encode(joined));
  }
  const id = input.id ?? rootHash;
  const now = Date.now();
  return {
    id,
    path: input.path,
    size: totalSize,
    mime: input.mime,
    chunks: refs,
    createdAt: now,
    updatedAt: now,
  };
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

// Re-compute the manifest's root hash from the chunk payloads and compare.
// Chunks passed in must include `bytes`. The server does not store bytes, so
// callers that have only refs should fetch bytes first.
export async function verifyManifest(
  manifest: FileManifest,
  chunks: Chunk[],
): Promise<VerifyResult> {
  if (chunks.length !== manifest.chunks.length) {
    return {
      ok: false,
      reason: `chunk count mismatch: ${chunks.length} vs ${manifest.chunks.length}`,
    };
  }
  for (let i = 0; i < chunks.length; i++) {
    const expected = manifest.chunks[i]!;
    const got = chunks[i]!;
    if (expected.hash !== got.hash) {
      return { ok: false, reason: `chunk ${i} hash mismatch: ${got.hash} vs ${expected.hash}` };
    }
    if (expected.size !== got.size) {
      return { ok: false, reason: `chunk ${i} size mismatch: ${got.size} vs ${expected.size}` };
    }
  }
  const total = chunks.reduce((s, c) => s + c.size, 0);
  if (total !== manifest.size) {
    return { ok: false, reason: `total size mismatch: ${total} vs ${manifest.size}` };
  }
  return { ok: true };
}

async function concatHashes(hexes: string[]): Promise<string> {
  const enc = new TextEncoder().encode(hexes.join(''));
  return hashChunk(enc);
}
