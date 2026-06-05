import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  appendChunk,
  cancelSession,
  markComplete,
  chunkIdempotencyKey,
  listSessionsForAccount,
  deleteSession,
  sessionToResponse
} from '../src/services/upload-session';
import type { UploadSession } from '../src/services/upload-session';

function makeSession(overrides: Partial<Parameters<typeof createSession>[0]> = {}): UploadSession {
  return createSession({
    accountId: 'acct-1',
    filename: 'test.bin',
    mimeType: 'application/octet-stream',
    totalSize: 1024 * 1024 * 100,
    chunkSize: 1024 * 1024,
    ...overrides
  });
}

describe('upload-session', () => {
  beforeEach(() => {
    // not strictly needed — sessions are in-memory and tests use unique account IDs
  });

  it('creates a session with open status and zero offset', () => {
    const s = makeSession();
    expect(s.id).toBeTruthy();
    expect(s.status).toBe('open');
    expect(s.offset).toBe(0);
    expect(s.chunks).toHaveLength(0);
  });

  it('rejects append with wrong offset', async () => {
    const s = makeSession();
    await expect(
      appendChunk({
        sessionId: s.id,
        offset: 100,
        data: Buffer.alloc(50),
        webhookUrl: 'https://discord.com/api/webhooks/x/y',
        chunkIndex: 0,
        idempotencyKey: 'k1'
      })
    ).rejects.toThrow(/Offset mismatch/);
  });

  it('returns duplicate result for repeated idempotency key', async () => {
    const s = makeSession();
    const key = chunkIdempotencyKey(s.id, 0, 0);

    s.chunks.push({
      index: 0,
      offset: 0,
      size: 100,
      url: 'https://cdn.discordapp.com/attachments/1/abc/x',
      discordMessageId: 'abc',
      sha256: 'x'.repeat(64)
    });
    s.offset = 100;
    s.idempotency.set(key, {
      status: 200,
      body: { attachment: { id: 'abc', url: 'https://cdn/x', filename: 'x', size: 100 } }
    });

    const result = await appendChunk({
      sessionId: s.id,
      offset: 100,
      data: Buffer.alloc(100),
      webhookUrl: 'https://discord.com/api/webhooks/x/y',
      chunkIndex: 1,
      idempotencyKey: key
    });
    expect(result.status).toBe('duplicate');
  });

  it('cancels a session', () => {
    const s = makeSession();
    expect(cancelSession(s.id)).toBe(true);
    expect(getSession(s.id)?.status).toBe('cancelled');
  });

  it('refuses to complete a session that is not full', () => {
    const s = makeSession({ totalSize: 1000 });
    s.offset = 500;
    expect(() => markComplete(s.id)).toThrow(/Cannot complete/);
  });

  it('completes a session at the right offset', () => {
    const s = makeSession({ totalSize: 1000 });
    s.offset = 1000;
    const done = markComplete(s.id);
    expect(done?.status).toBe('complete');
  });

  it('idempotency key is deterministic for same session+offset+index', () => {
    const k1 = chunkIdempotencyKey('s1', 0, 0);
    const k2 = chunkIdempotencyKey('s1', 0, 0);
    expect(k1).toBe(k2);
    const k3 = chunkIdempotencyKey('s1', 0, 1);
    expect(k1).not.toBe(k3);
  });

  it('lists sessions for an account only', () => {
    makeSession({ accountId: 'acct-A' });
    makeSession({ accountId: 'acct-A' });
    makeSession({ accountId: 'acct-B' });
    expect(listSessionsForAccount('acct-A')).toHaveLength(2);
    expect(listSessionsForAccount('acct-B')).toHaveLength(1);
  });

  it('deletes a session', () => {
    const s = makeSession();
    expect(deleteSession(s.id)).toBe(true);
    expect(getSession(s.id)).toBeUndefined();
  });

  it('sessionToResponse hides internal fields', () => {
    const s = makeSession();
    const r = sessionToResponse(s);
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('offset');
    expect(r).not.toHaveProperty('chunks');
    expect(r).not.toHaveProperty('idempotency');
  });
});
