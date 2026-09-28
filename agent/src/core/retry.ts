export type RetryOptions = {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: unknown) => boolean;
};

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = options.maxAttempts ?? 5;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; ; attempt += 1) {
    try { return await operation(attempt); } catch (error) {
      if (attempt >= attempts || (options.shouldRetry && !options.shouldRetry(error))) throw error;
      const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      const jitter = 0.5 + (options.random ?? Math.random)();
      await sleep(Math.min(options.maxDelayMs, Math.floor(exponential * jitter)));
    }
  }
}