import { describe, it, expect } from 'vitest';
import { chunkFile, DEFAULT_CHUNK_SIZE } from '../chunker.js';
import { hashChunk } from '../hasher.js';

describe('chunkFile', () => {
  it('chunks a small file into a single chunk', async () => {
    const data = new TextEncoder().encode('hello world');
    const chunks = await chunkFile(data, { chunkSize: 1024 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.size).toBe(11);
    expect(chunks[0]!.bytes).toEqual(data);
  });

  it('handles empty input as a single empty chunk', async () => {
    const chunks = await chunkFile(new Uint8Array(0), { chunkSize: 1024 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.size).toBe(0);
    expect(chunks[0]!.bytes.length).toBe(0);
  });

  it('chunks an exact-multiple file correctly', async () => {
    const data = new Uint8Array(2048);
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    const chunks = await chunkFile(data, { chunkSize: 1024 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.size).toBe(1024);
    expect(chunks[1]!.size).toBe(1024);
  });

  it('chunks a non-multiple file with a short tail', async () => {
    const data = new Uint8Array(2500);
    const chunks = await chunkFile(data, { chunkSize: 1024 });
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.size).toBe(1024);
    expect(chunks[1]!.size).toBe(1024);
    expect(chunks[2]!.size).toBe(452);
  });

  it('produces byte-identical chunks on repeated runs (deterministic)', async () => {
    const data = new Uint8Array(5000);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7) & 0xff;
    const a = await chunkFile(data, { chunkSize: 1024 });
    const b = await chunkFile(data, { chunkSize: 1024 });
    expect(a).toHaveLength(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.hash).toBe(b[i]!.hash);
      expect(a[i]!.size).toBe(b[i]!.size);
      expect(a[i]!.bytes).toEqual(b[i]!.bytes);
    }
  });

  it('rejects chunkSize <= 0', async () => {
    await expect(chunkFile(new Uint8Array(1), { chunkSize: 0 })).rejects.toThrow(RangeError);
  });
});

describe('hashChunk', () => {
  it('produces 64-char hex SHA-256', async () => {
    const h = await hashChunk(new TextEncoder().encode('abc'));
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes empty input to the well-known empty SHA-256', async () => {
    const h = await hashChunk(new Uint8Array(0));
    expect(h).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('default chunk size', () => {
  it('is 8 MiB', () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(8 * 1024 * 1024);
  });
});
