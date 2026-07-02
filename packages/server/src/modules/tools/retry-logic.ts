// Retry Logic — Agent OS v6.1

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: number;
  retryableErrors: string[];
}

export class RetryLogic {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelay: config.baseDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitter: config.jitter ?? 100,
      retryableErrors: config.retryableErrors ?? [
        'timeout',
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'network error',
      ],
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    isRetryable?: (error: Error) => boolean
  ): Promise<{ result: T; retries: number } | { error: string; retries: number }> {
    let lastError: Error | null = null;
    let retries = 0;

    while (retries <= this.config.maxRetries) {
      try {
        const result = await fn();
        return { result, retries };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;

        // Check if we should retry
        if (retries > this.config.maxRetries) break;
        if (!this.isRetryable(lastError, isRetryable)) break;

        // Wait before retry
        const delay = this.calculateDelay(retries);
        await this.sleep(delay);
      }
    }

    return {
      error: lastError?.message || 'Unknown error',
      retries: retries - 1,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error, customCheck?: (error: Error) => boolean): boolean {
    // Custom check takes priority
    if (customCheck) {
      return customCheck(error);
    }

    // Check against retryable errors
    const errorStr = error.message.toLowerCase();
    return this.config.retryableErrors.some((e) => errorStr.includes(e.toLowerCase()));
  }

  /**
   * Calculate delay with exponential backoff + jitter
   */
  private calculateDelay(attempt: number): number {
    const baseDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * this.config.jitter;
    return Math.min(baseDelay + jitter, this.config.maxDelay);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get config
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
