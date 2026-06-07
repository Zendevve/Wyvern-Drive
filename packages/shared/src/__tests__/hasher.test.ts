import { describe, it, expect } from 'vitest';
import { sha256, sha256Hex, hashChildren } from '../hasher.js';

describe('sha256', () => {
  it('matches the well-known SHA-256 of "abc"', async () => {
    const bytes = new TextEncoder().encode('abc');
    const raw = await sha256(bytes);
    expect(raw.length).toBe(32);
    expect(await sha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('hashChildren', () => {
  it('produces the same hash regardless of child order', async () => {
    const a = await hashChildren([
      { name: 'a', hash: '11'.repeat(32) },
      { name: 'b', hash: '22'.repeat(32) },
      { name: 'c', hash: '33'.repeat(32) },
    ]);
    const b = await hashChildren([
      { name: 'c', hash: '33'.repeat(32) },
      { name: 'a', hash: '11'.repeat(32) },
      { name: 'b', hash: '22'.repeat(32) },
    ]);
    expect(a).toBe(b);
  });

  it('differs when any child hash changes', async () => {
    const a = await hashChildren([{ name: 'a', hash: '11'.repeat(32) }]);
    const b = await hashChildren([{ name: 'a', hash: '99'.repeat(32) }]);
    expect(a).not.toBe(b);
  });
});
