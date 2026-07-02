// Circuit Breaker — Agent OS v6.1
import { CircuitState } from './types';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 60s
      halfOpenMaxAttempts: config.halfOpenMaxAttempts ?? 3,
    };
  }

  /**
   * Check if circuit is closed (allow execution)
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if reset timeout has passed
        if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
          this.state = 'half-open';
          this.halfOpenAttempts = 0;
          return true;
        }
        return false;

      case 'half-open':
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;

      default:
        return false;
    }
  }

  /**
   * Record success
   */
  recordSuccess(): void {
    switch (this.state) {
      case 'closed':
        this.failureCount = 0;
        break;

      case 'half-open':
        this.successCount++;
        if (this.successCount >= this.config.halfOpenMaxAttempts) {
          this.state = 'closed';
          this.failureCount = 0;
          this.successCount = 0;
        }
        break;
    }
  }

  /**
   * Record failure
   */
  recordFailure(): void {
    switch (this.state) {
      case 'closed':
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.state = 'open';
          this.lastFailureTime = Date.now();
        }
        break;

      case 'half-open':
        this.state = 'open';
        this.lastFailureTime = Date.now();
        this.halfOpenAttempts++;
        break;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get stats
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    timeUntilReset: number;
  } {
    let timeUntilReset = 0;
    if (this.state === 'open') {
      timeUntilReset = Math.max(0, this.config.resetTimeout - (Date.now() - this.lastFailureTime));
    }

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilReset,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }
}
