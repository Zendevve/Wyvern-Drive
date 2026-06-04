import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('respects concurrency limit', async () => {
    const limiter = new RateLimiter(2);
    const activeTasks: number[] = [];
    let maxConcurrent = 0;

    const runTask = async (id: number, duration: number) => {
      activeTasks.push(id);
      maxConcurrent = Math.max(maxConcurrent, activeTasks.length);
      await new Promise(resolve => setTimeout(resolve, duration));
      activeTasks.splice(activeTasks.indexOf(id), 1);
      return id;
    };

    const p1 = limiter.enqueue(() => runTask(1, 100));
    const p2 = limiter.enqueue(() => runTask(2, 100));
    const p3 = limiter.enqueue(() => runTask(3, 100));

    // Initially, task 1 and 2 should start because concurrency is 2. Task 3 should wait.
    expect(activeTasks).toContain(1);
    expect(activeTasks).toContain(2);
    expect(activeTasks).not.toContain(3);

    // Fast-forward 100ms so first two finish and task 3 starts
    await vi.advanceTimersByTimeAsync(100);

    // Now task 3 should be active, and 1 and 2 completed
    expect(activeTasks).toContain(3);
    expect(activeTasks).not.toContain(1);
    expect(activeTasks).not.toContain(2);

    // Fast-forward another 100ms so task 3 finishes
    await vi.advanceTimersByTimeAsync(100);

    await Promise.all([p1, p2, p3]);

    expect(maxConcurrent).toBe(2);
  });

  it('performs pre-emptive rate limiting based on routeKey and headers', async () => {
    const limiter = new RateLimiter(3);
    const routeKey = 'webhook_test';
    
    // Simulate first task finishing and returning rate limit headers indicating bucket is exhausted
    const headers = new Headers({
      'x-ratelimit-bucket': 'bucket_123',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset-after': '0.5', // 500ms
      'x-ratelimit-limit': '5'
    });

    let firstTaskCompleted = false;
    let secondTaskCompleted = false;

    const p1 = limiter.enqueue(async () => {
      // Simulate API call completing and updating limits
      limiter.updateLimits(routeKey, headers);
      firstTaskCompleted = true;
      return 1;
    }, routeKey);

    await p1;
    expect(firstTaskCompleted).toBe(true);

    // Enqueue second task on same route. It should be blocked pre-emptively because remaining = 0
    const p2 = limiter.enqueue(async () => {
      secondTaskCompleted = true;
      return 2;
    }, routeKey);

    // Let any macro-tasks execute
    await vi.advanceTimersByTimeAsync(10);
    expect(secondTaskCompleted).toBe(false);

    // Advance past the reset time (500ms + 50ms buffer)
    await vi.advanceTimersByTimeAsync(550);
    
    await p2;
    expect(secondTaskCompleted).toBe(true);
  });

  it('allows tasks for different routes to run even when one route is rate limited', async () => {
    const limiter = new RateLimiter(3);
    const routeA = 'route_a';
    const routeB = 'route_b';

    // Exhaust route A
    const headersA = new Headers({
      'x-ratelimit-bucket': 'bucket_a',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset-after': '1.0', // 1s
    });
    limiter.updateLimits(routeA, headersA);

    let routeBTaskCompleted = false;

    // Enqueue task on route B (which has no rate limits)
    const pB = limiter.enqueue(async () => {
      routeBTaskCompleted = true;
      return 'B';
    }, routeB);

    await pB;
    expect(routeBTaskCompleted).toBe(true);
  });
});
