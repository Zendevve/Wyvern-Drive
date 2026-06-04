import { describe, expect, it, vi } from 'vitest';
import { runWithConcurrency } from '../../src/lib/concurrency';

describe('runWithConcurrency', () => {
  it('returns results in the original order', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await runWithConcurrency(items, 2, async (n) => n * 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it('caps parallel workers at the supplied limit', async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    const result = await runWithConcurrency(items, 3, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return n;
    });
    expect(result).toEqual(items);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('rejects with the first error encountered', async () => {
    const items = [1, 2, 3, 4, 5];
    await expect(
      runWithConcurrency(items, 2, async (n) => {
        if (n === 3) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });

  it('returns an empty array for empty input', async () => {
    const result = await runWithConcurrency([], 3, async (n: number) => n);
    expect(result).toEqual([]);
  });

  it('coerces a zero or negative limit to 1', async () => {
    const items = [1, 2, 3];
    let active = 0;
    let peak = 0;
    await runWithConcurrency(items, 0, async (n: number) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return n;
    });
    expect(peak).toBe(1);
  });

  it('passes the item index to the worker', async () => {
    const worker = vi.fn(async (_n: number, _i: number) => _n);
    await runWithConcurrency([10, 20, 30], 2, worker);
    expect(worker).toHaveBeenCalledTimes(3);
    const indices = worker.mock.calls.map((call) => call[1]);
    expect(new Set(indices)).toEqual(new Set([0, 1, 2]));
  });
});
