// Deadlock Detector — Agent OS v6.1
import { WaitForEdge } from './types';

export class DeadlockDetector {
  private waitForGraph: Map<string, Set<string>> = new Map();
  private readonly maxWaitTime: number;

  constructor(maxWaitTime: number = 30000) {
    this.maxWaitTime = maxWaitTime;
  }

  /**
   * Add wait-for edge (agent A is waiting for agent B)
   */
  addEdge(from: string, to: string): void {
    if (!this.waitForGraph.has(from)) {
      this.waitForGraph.set(from, new Set());
    }
    this.waitForGraph.get(from)!.add(to);
  }

  /**
   * Remove wait-for edge
   */
  removeEdge(from: string, to: string): void {
    const edges = this.waitForGraph.get(from);
    if (edges) {
      edges.delete(to);
      if (edges.size === 0) {
        this.waitForGraph.delete(from);
      }
    }
  }

  /**
   * Remove all edges for an agent
   */
  removeAgent(agentId: string): void {
    this.waitForGraph.delete(agentId);
    for (const edges of this.waitForGraph.values()) {
      edges.delete(agentId);
    }
  }

  /**
   * Detect cycles using DFS
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.waitForGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle, neighbor]);
          return true;
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    };

    for (const node of this.waitForGraph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Find agents involved in deadlocks
   */
  findDeadlockedAgents(): string[] {
    const cycles = this.detectCycles();
    const deadlocked = new Set<string>();

    for (const cycle of cycles) {
      for (const agent of cycle) {
        deadlocked.add(agent);
      }
    }

    return Array.from(deadlocked);
  }

  /**
   * Break deadlock by finding the agent to kill
   */
  breakDeadlock(): string | null {
    const deadlocked = this.findDeadlockedAgents();
    if (deadlocked.length === 0) return null;

    // Kill the agent with lowest priority (or oldest task)
    // For now, return the first one
    return deadlocked[0];
  }

  /**
   * Check if specific agent is deadlocked
   */
  isDeadlocked(agentId: string): boolean {
    const deadlocked = this.findDeadlockedAgents();
    return deadlocked.includes(agentId);
  }

  /**
   * Get wait-for graph as edges
   */
  getEdges(): WaitForEdge[] {
    const edges: WaitForEdge[] = [];
    for (const [from, tos] of this.waitForGraph.entries()) {
      for (const to of tos) {
        edges.push({ from, to });
      }
    }
    return edges;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalEdges: number;
    totalAgents: number;
    hasDeadlock: boolean;
    deadlockedAgents: string[];
  } {
    const deadlocked = this.findDeadlockedAgents();
    return {
      totalEdges: this.getEdges().length,
      totalAgents: this.waitForGraph.size,
      hasDeadlock: deadlocked.length > 0,
      deadlockedAgents: deadlocked,
    };
  }

  /**
   * Clear graph
   */
  clear(): void {
    this.waitForGraph.clear();
  }
}
