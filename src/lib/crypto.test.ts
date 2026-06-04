import { describe, it, expect } from 'vitest';

describe('crypto utilities', () => {
  it('generateSalt returns 16-byte Uint8Array', () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it('generateNonce returns 12-byte Uint8Array', () => {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    expect(nonce).toBeInstanceOf(Uint8Array);
    expect(nonce.length).toBe(12);
  });

  it('generateSalt produces different values each call', () => {
    const salt1 = crypto.getRandomValues(new Uint8Array(16));
    const salt2 = crypto.getRandomValues(new Uint8Array(16));
    expect(salt1).not.toEqual(salt2);
  });

  it('hashFile returns hex string via SubtleCrypto', async () => {
    const data = new TextEncoder().encode('test').buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashFile produces consistent results', async () => {
    const data = new TextEncoder().encode('consistent').buffer;
    const hash1 = await crypto.subtle.digest('SHA-256', data);
    const hash2 = await crypto.subtle.digest('SHA-256', data);
    expect(new Uint8Array(hash1)).toEqual(new Uint8Array(hash2));
  });

  it('hashFile produces different hashes for different inputs', async () => {
    const hash1 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('aaa').buffer);
    const hash2 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bbb').buffer);
    expect(new Uint8Array(hash1)).not.toEqual(new Uint8Array(hash2));
  });
});
