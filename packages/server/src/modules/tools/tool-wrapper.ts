// Tool Wrapper — Agent OS v6.1
import { ToolConfig, ToolResult, ToolExecution } from './types';
import { TimeoutManager } from './timeout-manager';
import { RetryLogic } from './retry-logic';
import { CircuitBreaker } from './circuit-breaker';
import { SandboxIsolator } from './sandbox-isolator';

export class ToolWrapper {
  private tools: Map<string, ToolConfig> = new Map();
  private timeoutManager: TimeoutManager;
  private retryLogic: RetryLogic;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private sandbox: SandboxIsolator;
  private executions: ToolExecution[] = [];

  constructor() {
    this.timeoutManager = new TimeoutManager();
    this.retryLogic = new RetryLogic();
    this.sandbox = new SandboxIsolator();
  }

  /**
   * Register a tool
   */
  register(config: ToolConfig): void {
    this.tools.set(config.name, config);
    this.circuitBreakers.set(
      config.name,
      new CircuitBreaker(config.circuitBreaker)
    );
  }

  /**
   * Execute tool with all protections
   */
  async execute<T>(
    toolName: string,
    fn: () => Promise<T>,
    agentId: string,
    options: { path?: string; host?: string } = {}
  ): Promise<ToolResult<T>> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: string | undefined;

    // Get tool config
    const config = this.tools.get(toolName);
    if (!config) {
      return {
        success: false,
        error: `Tool not registered: ${toolName}`,
        duration: Date.now() - startTime,
        retries: 0,
        circuitState: 'closed',
      };
    }

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(toolName)!;
    if (!circuitBreaker.canExecute()) {
      return {
        success: false,
        error: `Circuit breaker is OPEN for tool: ${toolName}`,
        duration: Date.now() - startTime,
        retries: 0,
        circuitState: circuitBreaker.getState(),
      };
    }

    // Validate sandbox
    const validation = this.sandbox.validate(toolName, options);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        duration: Date.now() - startTime,
        retries: 0,
        circuitState: circuitBreaker.getState(),
      };
    }

    // Execute with retry
    const maxRetries = config.maxRetries ?? 3;
    const timeout = this.timeoutManager.get(toolName);

    while (retries <= maxRetries) {
      try {
        // Execute with timeout
        const result = await this.timeoutManager.execute(fn, timeout);

        if ('error' in result) {
          // Timeout or execution error
          lastError = result.error;
          circuitBreaker.recordFailure();
          retries++;

          if (retries > maxRetries) break;

          // Wait before retry
          const delay = 1000 * Math.pow(2, retries - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Success
        circuitBreaker.recordSuccess();
        this.logExecution({
          tool: toolName,
          agentId,
          startTime,
          endTime: Date.now(),
          success: true,
          retries,
        });

        return {
          success: true,
          data: result.result,
          duration: result.duration,
          retries,
          circuitState: circuitBreaker.getState(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        circuitBreaker.recordFailure();
        retries++;

        if (retries > maxRetries) break;

        // Wait before retry
        const delay = 1000 * Math.pow(2, retries - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    this.logExecution({
      tool: toolName,
      agentId,
      startTime,
      endTime: Date.now(),
      success: false,
      retries: retries - 1,
      error: lastError,
    });

    return {
      success: false,
      error: lastError || 'Unknown error',
      duration: Date.now() - startTime,
      retries: retries - 1,
      circuitState: circuitBreaker.getState(),
    };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(toolName: string): ReturnType<CircuitBreaker['getStats']> | undefined {
    return this.circuitBreakers.get(toolName)?.getStats();
  }

  /**
   * Get sandbox usage
   */
  getSandboxUsage(): ReturnType<SandboxIsolator['getUsage']> {
    return this.sandbox.getUsage();
  }

  /**
   * Get recent executions
   */
  getExecutions(limit: number = 100): ToolExecution[] {
    return this.executions.slice(-limit);
  }

  /**
   * Log execution
   */
  private logExecution(execution: ToolExecution): void {
    this.executions.push(execution);
    // Keep last 1000 executions
    if (this.executions.length > 1000) {
      this.executions = this.executions.slice(-1000);
    }
  }

  /**
   * Get stats
   */
  getStats(): {
    registeredTools: number;
    circuitBreakers: Record<string, ReturnType<CircuitBreaker['getStats']>>;
    recentExecutions: number;
    successRate: number;
  } {
    const circuitBreakers: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakers[name] = breaker.getStats();
    }

    const recent = this.executions.slice(-100);
    const success = recent.filter((e) => e.success).length;

    return {
      registeredTools: this.tools.size,
      circuitBreakers,
      recentExecutions: this.executions.length,
      successRate: recent.length > 0 ? success / recent.length : 1,
    };
  }
}
