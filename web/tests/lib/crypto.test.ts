import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deriveAccountId } from '../../src/lib/crypto';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('deriveAccountId', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const id = await deriveAccountId('https://discord.com/api/webhooks/123/abc');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', async () => {
    const url = 'https://discord.com/api/webhooks/123/abc';
    const a = await deriveAccountId(url);
    const b = await deriveAccountId(url);
    expect(a).toBe(b);
  });

  it('changes when the input changes', async () => {
    const a = await deriveAccountId('https://discord.com/api/webhooks/1/a');
    const b = await deriveAccountId('https://discord.com/api/webhooks/2/b');
    expect(a).not.toBe(b);
  });

  it('matches the server SHA-256 hex for a known input', async () => {
    const url = 'https://discord.com/api/webhooks/1234567890/abc-123_xyz';
    const expected = sha256Hex(url);
    const id = await deriveAccountId(url);
    expect(id).toBe(expected);
  });

  it('handles unicode inputs without throwing', async () => {
    const id = await deriveAccountId('wyvérn-🐉-naïve');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches sha256("") for an empty input', async () => {
    const id = await deriveAccountId('');
    expect(id).toBe(sha256Hex(''));
  });
});
