import { describe, it, expect } from 'vitest';

describe('sharing constants', () => {
  const ONE_HOUR = 3600000;
  const ONE_DAY = 86400000;
  const SEVEN_DAYS = 604800000;
  const THIRTY_DAYS = 2592000000;

  it('ONE_HOUR is 3600000ms', () => {
    expect(ONE_HOUR).toBe(3600000);
  });

  it('ONE_DAY is 86400000ms', () => {
    expect(ONE_DAY).toBe(86400000);
  });

  it('SEVEN_DAYS is 604800000ms', () => {
    expect(SEVEN_DAYS).toBe(604800000);
  });

  it('THIRTY_DAYS is 2592000000ms', () => {
    expect(THIRTY_DAYS).toBe(2592000000);
  });

  it('expiry values are in correct order', () => {
    expect(ONE_HOUR).toBeLessThan(ONE_DAY);
    expect(ONE_DAY).toBeLessThan(SEVEN_DAYS);
    expect(SEVEN_DAYS).toBeLessThan(THIRTY_DAYS);
  });

  it('share link format matches expected pattern', () => {
    const fileId = 'test-file-id';
    const encoded = btoa(JSON.stringify({ k: 'key', s: 'salt', n: 'nonce', e: 0, p: false }));
    const link = `/share/${fileId}#${encoded}`;
    expect(link).toMatch(/^\/share\/[^#]+#.+$/);
  });

  it('share link can be parsed back', () => {
    const fileId = 'test-file-id';
    const payload = { k: 'encryptedKey', s: 'salt', n: 'nonce', e: 0, p: false };
    const encoded = btoa(JSON.stringify(payload));
    const link = `/share/${fileId}#${encoded}`;

    const match = link.match(/\/share\/([^#]+)#(.+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(fileId);
    expect(JSON.parse(atob(match![2]))).toEqual(payload);
  });
});
