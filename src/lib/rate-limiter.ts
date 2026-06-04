export class RateLimiter {
  private queue: Array<{
    fn: () => Promise<any>;
    routeKey: string;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];

  private activeCount = 0;
  private concurrencyLimit: number;
  private maxRetries = 5;
  private baseDelay = 1000;

  // Track bucket states: bucketId -> BucketState
  private bucketStates = new Map<string, {
    limit: number;
    remaining: number;
    resetTime: number;
  }>();

  // Track routeKey -> bucketId
  private routeToBucket = new Map<string, string>();

  private processTimeout: NodeJS.Timeout | null = null;

  constructor(concurrencyLimit = 3) {
    this.concurrencyLimit = concurrencyLimit;
  }

  async enqueue<T>(fn: () => Promise<T>, routeKey = 'global'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn,
        routeKey,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  private isRunnable(routeKey: string): boolean {
    const bucketId = this.routeToBucket.get(routeKey);
    if (!bucketId) return true;

    const state = this.bucketStates.get(bucketId);
    if (!state) return true;

    if (state.remaining <= 0 && Date.now() < state.resetTime) {
      return false;
    }

    return true;
  }

  private decrementRemaining(routeKey: string): void {
    const bucketId = this.routeToBucket.get(routeKey);
    if (!bucketId) return;

    const state = this.bucketStates.get(bucketId);
    if (!state) return;

    state.remaining = Math.max(0, state.remaining - 1);
  }

  private scheduleNextProcess() {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }

    let earliestReset = Infinity;
    const now = Date.now();

    for (const state of this.bucketStates.values()) {
      if (state.remaining <= 0 && state.resetTime > now) {
        if (state.resetTime < earliestReset) {
          earliestReset = state.resetTime;
        }
      }
    }

    if (earliestReset !== Infinity) {
      const delay = Math.max(0, earliestReset - now);
      this.processTimeout = setTimeout(() => {
        this.processTimeout = null;
        this.processQueue();
      }, delay + 50); // 50ms buffer to ensure server-side expiration
    }
  }

  private processQueue() {
    while (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      const taskIndex = this.queue.findIndex(task => this.isRunnable(task.routeKey));

      if (taskIndex === -1) {
        this.scheduleNextProcess();
        break;
      }

      const task = this.queue.splice(taskIndex, 1)[0];
      this.decrementRemaining(task.routeKey);
      this.activeCount++;

      this.executeWithRetry(task.fn, task.routeKey)
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  updateLimits(routeKey: string, headers: Headers, retryAfter?: number) {
    const bucketId = headers.get('x-ratelimit-bucket') || headers.get('X-RateLimit-Bucket');
    const remainingStr = headers.get('x-ratelimit-remaining') || headers.get('X-RateLimit-Remaining');
    const resetAfterStr = headers.get('x-ratelimit-reset-after') || headers.get('X-RateLimit-Reset-After');
    const limitStr = headers.get('x-ratelimit-limit') || headers.get('X-RateLimit-Limit');

    const remaining = remainingStr ? parseInt(remainingStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const resetAfter = resetAfterStr ? parseFloat(resetAfterStr) : undefined;

    const now = Date.now();
    let resetTime = now;

    if (retryAfter !== undefined) {
      resetTime = now + (retryAfter * 1000);
    } else if (resetAfter !== undefined) {
      resetTime = now + (resetAfter * 1000);
    }

    if (bucketId) {
      this.routeToBucket.set(routeKey, bucketId);

      const existing = this.bucketStates.get(bucketId);
      const newRemaining = remaining !== undefined ? remaining : (existing?.remaining ?? 1);
      const newLimit = limit !== undefined ? limit : (existing?.limit ?? 1);

      this.bucketStates.set(bucketId, {
        limit: newLimit,
        remaining: newRemaining,
        resetTime: Math.max(existing?.resetTime ?? 0, resetTime)
      });
    } else if (retryAfter !== undefined) {
      const tempBucketId = `temp_${routeKey}`;
      this.routeToBucket.set(routeKey, tempBucketId);
      this.bucketStates.set(tempBucketId, {
        limit: 1,
        remaining: 0,
        resetTime
      });
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, routeKey: string): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err as Error;
        if (err instanceof DiscordRateLimitError) {
          this.updateLimits(routeKey, new Headers(), err.retryAfter);
          const delay = err.retryAfter
            ? err.retryAfter * 1000
            : Math.min(this.baseDelay * Math.pow(2, attempt), 60_000);
          await this.sleep(delay);
        } else if (err instanceof DiscordApiError && (err.status === 401 || err.status === 403)) {
          throw err;
        } else {
          if (attempt === this.maxRetries) throw err;
          await this.sleep(Math.min(this.baseDelay * Math.pow(2, attempt), 60_000));
        }
      }
    }
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class DiscordRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}s`);
    this.name = 'DiscordRateLimitError';
  }
}

export class DiscordApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'DiscordApiError';
  }
}
