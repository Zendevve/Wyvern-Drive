export class RateLimiter {
  private queue: Array<() => Promise<unknown>> = [];
  private processing = false;
  private maxRetries = 5;
  private baseDelay = 1000;

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
    }
    this.processing = false;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err as Error;
        if (err instanceof DiscordRateLimitError) {
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
