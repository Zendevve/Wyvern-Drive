import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JWT_KEY, clearJwt, readJwt, writeJwt } from '../../src/lib/storage';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('returns null when no JWT is set', () => {
    expect(readJwt()).toBeNull();
  });

  it('writes and reads a JWT under wyvern.jwt', () => {
    writeJwt('header.payload.sig');
    expect(localStorage.getItem(JWT_KEY)).toBe('header.payload.sig');
    expect(readJwt()).toBe('header.payload.sig');
  });

  it('clearJwt removes the key', () => {
    writeJwt('token');
    expect(readJwt()).not.toBeNull();
    clearJwt();
    expect(readJwt()).toBeNull();
    expect(localStorage.getItem(JWT_KEY)).toBeNull();
  });

  it('readJwt returns null when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readJwt()).toBeNull();
    spy.mockRestore();
  });

  it('writeJwt swallows localStorage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => writeJwt('x')).not.toThrow();
    spy.mockRestore();
  });

  it('clearJwt swallows localStorage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearJwt()).not.toThrow();
    spy.mockRestore();
  });
});
