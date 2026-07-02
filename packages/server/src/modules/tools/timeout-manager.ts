// Timeout Manager — Agent OS v6.1

export class TimeoutManager {
  private defaultTimeout: number;
  private timeouts: Map<string, number> = new Map();

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Set timeout for a specific tool
   */
  set(toolName: string, timeout: number): void {
    this.timeouts.set(toolName, timeout);
  }

  /**
   * Get timeout for a tool
   */
  get(toolName: string): number {
    return this.timeouts.get(toolName) || this.defaultTimeout;
  }

  /**
   * Execute function with timeout
   */
  async execute<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<{ result: T; duration: number } | { error: string; duration: number }> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          error: `Timeout after ${timeout}ms`,
          duration: Date.now() - startTime,
        });
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve({ result, duration: Date.now() - startTime });
        })
        .catch((error) => {
          clearTimeout(timer);
          resolve({
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
          });
        });
    });
  }

  /**
   * Create AbortController with timeout
   */
  createAbortController(toolName: string): AbortController {
    const controller = new AbortController();
    const timeout = this.get(toolName);

    setTimeout(() => {
      controller.abort();
    }, timeout);

    return controller;
  }
}
