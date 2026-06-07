import { describe, it, expect } from 'vitest';
import { buildManifest, verifyManifest } from '../manifest.js';
import { chunkFile } from '../chunker.js';
import type { Chunk } from '../types.js';

const fileToChunks = async (data: Uint8Array, chunkSize: number): Promise<Chunk[]> =>
  chunkFile(data, { chunkSize });

describe('buildManifest', () => {
  it('produces a manifest with one ref per chunk and total size', async () => {
    const data = new Uint8Array(2500);
    const chunks = await fileToChunks(data, 1024);
    const m = await buildManifest({
      path: 'foo.bin',
      mime: 'application/octet-stream',
      chunks,
    });
    expect(m.size).toBe(2500);
    expect(m.chunks).toHaveLength(3);
    expect(m.chunks.map((c) => c.size)).toEqual([1024, 1024, 452]);
    expect(m.encrypted).toBeUndefined();
  });

  it('manifest id defaults to the root hash', async () => {
    const chunks = await fileToChunks(new TextEncoder().encode('hi'), 1024);
    const m = await buildManifest({ path: 'x.txt', mime: 'text/plain', chunks });
    expect(m.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an empty chunk list', async () => {
    await expect(buildManifest({ path: 'x', mime: 'text/plain', chunks: [] })).rejects.toThrow(
      RangeError,
    );
  });
});

describe('verifyManifest', () => {
  it('returns ok for matching chunks', async () => {
    const data = new Uint8Array(2048);
    const chunks = await fileToChunks(data, 1024);
    const m = await buildManifest({ path: 'a', mime: 'application/octet-stream', chunks });
    const result = await verifyManifest(m, chunks);
    expect(result.ok).toBe(true);
  });

  it('detects a tampered chunk', async () => {
    const data = new Uint8Array(1024);
    const chunks = await fileToChunks(data, 1024);
    const m = await buildManifest({ path: 'a', mime: 'application/octet-stream', chunks });
    const tampered: Chunk[] = [
      { ...chunks[0]!, bytes: new Uint8Array(1024), hash: '0'.repeat(64) },
      ...chunks.slice(1),
    ];
    const result = await verifyManifest(m, tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/hash mismatch/);
  });

  it('detects a missing chunk', async () => {
    const data = new Uint8Array(2048);
    const chunks = await fileToChunks(data, 1024);
    const m = await buildManifest({ path: 'a', mime: 'application/octet-stream', chunks });
    const result = await verifyManifest(m, chunks.slice(0, 1));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/chunk count mismatch/);
  });
});
