// Load Balancer — Agent OS v6.1
import { AgentStatus } from './types';

export type LoadBalancingStrategy = 'round-robin' | 'least-connection' | 'resource-aware';

export class LoadBalancer {
  private agents: Map<string, AgentStatus> = new Map();
  private strategy: LoadBalancingStrategy;
  private roundRobinIndex: number = 0;

  constructor(strategy: LoadBalancingStrategy = 'round-robin') {
    this.strategy = strategy;
  }

  /**
   * Register agent
   */
  register(agentId: string): void {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, {
        id: agentId,
        busy: false,
        completedTasks: 0,
        failedTasks: 0,
        totalWaitTime: 0,
        lastActive: Date.now(),
      });
    }
  }

  /**
   * Unregister agent
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get next agent based on strategy
   */
  getNext(): string | null {
    const available = this.getAvailableAgents();
    if (available.length === 0) return null;

    switch (this.strategy) {
      case 'round-robin':
        return this.getRoundRobin(available);
      case 'least-connection':
        return this.getLeastConnection(available);
      case 'resource-aware':
        return this.getResourceAware(available);
      default:
        return this.getRoundRobin(available);
    }
  }

  /**
   * Get available (idle) agents
   */
  getAvailableAgents(): string[] {
    const available: string[] = [];
    for (const [agentId, status] of this.agents.entries()) {
      if (!status.busy) {
        available.push(agentId);
      }
    }
    return available;
  }

  /**
   * Round-robin selection
   */
  private getRoundRobin(available: string[]): string {
    const selected = available[this.roundRobinIndex % available.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % available.length;
    return selected;
  }

  /**
   * Least-connection selection (agent with fewest active tasks)
   */
  private getLeastConnection(available: string[]): string {
    let minTasks = Infinity;
    let selected = available[0];

    for (const agentId of available) {
      const agent = this.agents.get(agentId);
      if (agent && agent.completedTasks < minTasks) {
        minTasks = agent.completedTasks;
        selected = agentId;
      }
    }

    return selected;
  }

  /**
   * Resource-aware selection (consider wait time, success rate)
   */
  private getResourceAware(available: string[]): string {
    let bestScore = -Infinity;
    let selected = available[0];

    for (const agentId of available) {
      const agent = this.agents.get(agentId);
      if (!agent) continue;

      // Score: higher is better
      const successRate = agent.completedTasks + agent.failedTasks > 0
        ? agent.completedTasks / (agent.completedTasks + agent.failedTasks)
        : 0.5;
      const waitPenalty = agent.totalWaitTime / 10000; // Normalize
      const score = successRate * 100 - waitPenalty;

      if (score > bestScore) {
        bestScore = score;
        selected = agentId;
      }
    }

    return selected;
  }

  /**
   * Mark agent as busy
   */
  markBusy(agentId: string, taskId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.busy = true;
      agent.currentTask = taskId;
      agent.lastActive = Date.now();
    }
  }

  /**
   * Mark agent as idle
   */
  markIdle(agentId: string, success: boolean): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.busy = false;
      agent.currentTask = undefined;
      agent.lastActive = Date.now();
      if (success) {
        agent.completedTasks++;
      } else {
        agent.failedTasks++;
      }
    }
  }

  /**
   * Get agent status
   */
  getStatus(agentId: string): AgentStatus | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get stats
   */
  getStats(): {
    totalAgents: number;
    availableAgents: number;
    busyAgents: number;
    strategy: LoadBalancingStrategy;
  } {
    let busy = 0;
    for (const agent of this.agents.values()) {
      if (agent.busy) busy++;
    }

    return {
      totalAgents: this.agents.size,
      availableAgents: this.agents.size - busy,
      busyAgents: busy,
      strategy: this.strategy,
    };
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
    this.roundRobinIndex = 0;
  }
}
