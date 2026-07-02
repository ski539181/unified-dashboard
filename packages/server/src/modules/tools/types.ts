// Tool Wrapper Types — Agent OS v6.1

export interface ToolConfig {
  name: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  sandbox?: SandboxConfig;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface SandboxConfig {
  maxMemory?: number; // MB
  maxCpu?: number; // percentage (0-100)
  allowedPaths?: string[];
  blockedPaths?: string[];
  networkWhitelist?: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxAttempts?: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
  retries: number;
  circuitState: CircuitState;
}

export interface ToolExecution {
  tool: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  retries: number;
  error?: string;
}
