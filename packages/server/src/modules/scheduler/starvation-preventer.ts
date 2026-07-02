// Starvation Preventer — Agent OS v6.1
import { AgentStatus, Priority } from './types';

export class StarvationPreventer {
  private agents: Map<string, AgentStatus> = new Map();
  private readonly maxWaitTime: number;
  private readonly fairSharePercentage: number;

  constructor(maxWaitTime: number = 60000, fairSharePercentage: number = 10) {
    this.maxWaitTime = maxWaitTime;
    this.fairSharePercentage = fairSharePercentage;
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
   * Update wait time for agent
   */
  updateWaitTime(agentId: string, waitTime: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.totalWaitTime += waitTime;
    }
  }

  /**
   * Check if agent is starved (waited too long)
   */
  isStarved(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    return agent.totalWaitTime >= this.maxWaitTime;
  }

  /**
   * Get starved agents
   */
  getStarvedAgents(): string[] {
    const starved: string[] = [];
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.totalWaitTime >= this.maxWaitTime) {
        starved.push(agentId);
      }
    }
    return starved;
  }

  /**
   * Boost priority for starved agents
   */
  boostPriority(currentPriority: Priority, agentId: string): Priority {
    if (!this.isStarved(agentId)) {
      return currentPriority;
    }

    // Boost by one level
    const priorities: Priority[] = ['P3', 'P2', 'P1', 'P0'];
    const currentIndex = priorities.indexOf(currentPriority);
    if (currentIndex < priorities.length - 1) {
      return priorities[currentIndex + 1];
    }
    return currentPriority;
  }

  /**
   * Check fair share (each agent gets minimum percentage)
   */
  checkFairShare(agentId: string, totalTasks: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return true;

    const agentShare = (agent.completedTasks / totalTasks) * 100;
    return agentShare >= this.fairSharePercentage;
  }

  /**
   * Get agent with least completed tasks (for fair scheduling)
   */
  getLeastServedAgent(): string | null {
    let minCompleted = Infinity;
    let leastServed: string | null = null;

    for (const [agentId, agent] of this.agents.entries()) {
      if (!agent.busy && agent.completedTasks < minCompleted) {
        minCompleted = agent.completedTasks;
        leastServed = agentId;
      }
    }

    return leastServed;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalAgents: number;
    busyAgents: number;
    idleAgents: number;
    starvedAgents: number;
    averageWaitTime: number;
  } {
    let busy = 0;
    let idle = 0;
    let starved = 0;
    let totalWait = 0;

    for (const agent of this.agents.values()) {
      if (agent.busy) busy++;
      else idle++;
      if (agent.totalWaitTime >= this.maxWaitTime) starved++;
      totalWait += agent.totalWaitTime;
    }

    return {
      totalAgents: this.agents.size,
      busyAgents: busy,
      idleAgents: idle,
      starvedAgents: starved,
      averageWaitTime: this.agents.size > 0 ? totalWait / this.agents.size : 0,
    };
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
  }
}
