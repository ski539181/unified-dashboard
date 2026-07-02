// Sandbox Isolator — Agent OS v6.1
import { SandboxConfig } from './types';

export class SandboxIsolator {
  private config: SandboxConfig;
  private executions: Map<string, { memory: number; cpu: number }> = new Map();

  constructor(config: SandboxConfig = {}) {
    this.config = {
      maxMemory: config.maxMemory ?? 512, // MB
      maxCpu: config.maxCpu ?? 50, // percentage
      allowedPaths: config.allowedPaths ?? [],
      blockedPaths: config.blockedPaths ?? [
        '/etc',
        '/usr',
        '/bin',
        '/sbin',
        '/var',
        '/System',
        '/Library',
      ],
      networkWhitelist: config.networkWhitelist ?? [],
    };
  }

  /**
   * Check if path is allowed
   */
  isPathAllowed(path: string): boolean {
    // Check blocked paths first
    for (const blocked of this.config.blockedPaths) {
      if (path.startsWith(blocked)) {
        return false;
      }
    }

    // If allowed paths are specified, check against them
    if (this.config.allowedPaths.length > 0) {
      return this.config.allowedPaths.some((allowed) => path.startsWith(allowed));
    }

    return true;
  }

  /**
   * Check if network host is allowed
   */
  isNetworkAllowed(host: string): boolean {
    // If whitelist is empty, allow all
    if (this.config.networkWhitelist.length === 0) {
      return true;
    }

    return this.config.networkWhitelist.some((allowed) => host.includes(allowed));
  }

  /**
   * Check if memory usage is within limits
   */
  isMemoryAllowed(toolId: string, requestedMemory: number): boolean {
    const current = this.executions.get(toolId)?.memory || 0;
    return current + requestedMemory <= (this.config.maxMemory || 512);
  }

  /**
   * Check if CPU usage is within limits
   */
  isCpuAllowed(toolId: string, requestedCpu: number): boolean {
    const current = this.executions.get(toolId)?.cpu || 0;
    return current + requestedCpu <= (this.config.maxCpu || 50);
  }

  /**
   * Register tool execution
   */
  register(toolId: string, memory: number = 0, cpu: number = 0): void {
    const current = this.executions.get(toolId) || { memory: 0, cpu: 0 };
    this.executions.set(toolId, {
      memory: current.memory + memory,
      cpu: current.cpu + cpu,
    });
  }

  /**
   * Unregister tool execution
   */
  unregister(toolId: string): void {
    this.executions.delete(toolId);
  }

  /**
   * Get resource usage
   */
  getUsage(): { totalMemory: number; totalCpu: number; activeTools: number } {
    let totalMemory = 0;
    let totalCpu = 0;

    for (const usage of this.executions.values()) {
      totalMemory += usage.memory;
      totalCpu += usage.cpu;
    }

    return {
      totalMemory,
      totalCpu,
      activeTools: this.executions.size,
    };
  }

  /**
   * Validate tool execution
   */
  validate(toolId: string, options: {
    path?: string;
    host?: string;
    memory?: number;
    cpu?: number;
  }): { allowed: boolean; reason?: string } {
    // Check path
    if (options.path && !this.isPathAllowed(options.path)) {
      return { allowed: false, reason: `Path not allowed: ${options.path}` };
    }

    // Check network
    if (options.host && !this.isNetworkAllowed(options.host)) {
      return { allowed: false, reason: `Network host not allowed: ${options.host}` };
    }

    // Check memory
    if (options.memory && !this.isMemoryAllowed(toolId, options.memory)) {
      return { allowed: false, reason: `Memory limit exceeded: ${options.memory}MB` };
    }

    // Check CPU
    if (options.cpu && !this.isCpuAllowed(toolId, options.cpu)) {
      return { allowed: false, reason: `CPU limit exceeded: ${options.cpu}%` };
    }

    return { allowed: true };
  }

  /**
   * Get config
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }
}
