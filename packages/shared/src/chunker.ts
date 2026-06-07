// Deterministic file chunker. Same input → same chunks, byte-for-byte.
// Uses WebCrypto SHA-256 for content addressing.

import type { Chunk } from './types.js';
import { hashChunk } from './hasher.js';

export interface ChunkOptions {
  chunkSize: number;
}

export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

export async function chunkFile(
  input: ArrayBuffer | Uint8Array,
  opts: ChunkOptions = { chunkSize: DEFAULT_CHUNK_SIZE },
): Promise<Chunk[]> {
  if (opts.chunkSize <= 0) {
    throw new RangeError('chunkSize must be > 0');
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const out: Chunk[] = [];

  if (bytes.length === 0) {
    out.push({
      index: 0,
      hash: await hashChunk(new Uint8Array(0)),
      bytes: new Uint8Array(0),
      size: 0,
    });
    return out;
  }

  for (let offset = 0, index = 0; offset < bytes.length; offset += opts.chunkSize, index++) {
    const end = Math.min(offset + opts.chunkSize, bytes.length);
    const slice = bytes.subarray(offset, end);
    const copy = new Uint8Array(slice);
    out.push({
      index,
      hash: await hashChunk(copy),
      bytes: copy,
      size: copy.length,
    });
  }

  return out;
}
