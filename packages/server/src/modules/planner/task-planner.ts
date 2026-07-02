// Task Planner — Agent OS v6.1
import { TaskNode, TaskGraph, ExecutionPlan, PlannerConfig } from './types';
import { CycleDetector } from './cycle-detector';
import { DepthChecker } from './depth-checker';

export class TaskPlanner {
  private graph: TaskGraph;
  private config: PlannerConfig;
  private depthChecker: DepthChecker;

  constructor(config: PlannerConfig = { maxDepth: 5, maxTasks: 100, cycleDetectionEnabled: true }) {
    this.config = config;
    this.graph = { nodes: new Map(), edges: new Map() };
    this.depthChecker = new DepthChecker(config.maxDepth);
  }

  /**
   * Add task to graph
   */
  addTask(task: TaskNode): void {
    // Check max tasks
    if (this.graph.nodes.size >= this.config.maxTasks) {
      throw new Error(`Max tasks exceeded: ${this.config.maxTasks}`);
    }

    // Add node
    this.graph.nodes.set(task.id, task);

    // Add edges
    if (!this.graph.edges.has(task.id)) {
      this.graph.edges.set(task.id, new Set());
    }

    // Add reverse edges (dependencies)
    for (const depId of task.dependencies) {
      if (!this.graph.edges.has(depId)) {
        this.graph.edges.set(depId, new Set());
      }
      this.graph.edges.get(depId)!.add(task.id);
    }

    // Check for cycles
    if (this.config.cycleDetectionEnabled && CycleDetector.hasCycle(this.graph)) {
      // Remove the edge that caused the cycle
      const result = CycleDetector.breakCycle(this.graph);
      if (result.broken) {
        console.warn(`Cycle detected and broken: ${result.removedEdge}`);
      }
    }

    // Check depth
    if (this.depthChecker.exceedsMaxDepth(this.graph)) {
      throw new Error(`Max depth exceeded: ${this.config.maxDepth}`);
    }
  }

  /**
   * Remove task from graph
   */
  removeTask(taskId: string): void {
    this.graph.nodes.delete(taskId);
    this.graph.edges.delete(taskId);

    // Remove from other nodes' edges
    for (const edges of this.graph.edges.values()) {
      edges.delete(taskId);
    }
  }

  /**
   * Get execution plan (topological sort with parallelism)
   */
  getExecutionPlan(): ExecutionPlan {
    // Check for cycles
    if (this.config.cycleDetectionEnabled && CycleDetector.hasCycle(this.graph)) {
      throw new Error('Cannot create execution plan: cycle detected');
    }

    // Topological sort
    const sorted = this.topologicalSort();

    // Group by parallel execution
    const parallelGroups = this.groupByParallel(sorted);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath();

    // Calculate total duration
    const totalDuration = this.calculateTotalDuration(parallelGroups);

    return {
      tasks: sorted,
      parallelGroups,
      totalDuration,
      criticalPath,
    };
  }

  /**
   * Topological sort (Kahn's algorithm)
   */
  private topologicalSort(): TaskNode[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const sorted: TaskNode[] = [];

    // Calculate in-degrees
    for (const [nodeId, node] of this.graph.nodes.entries()) {
      inDegree.set(nodeId, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(nodeId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = this.graph.nodes.get(nodeId)!;
      sorted.push(node);

      // Reduce in-degree for dependents
      const dependents = this.graph.edges.get(nodeId) || new Set();
      for (const depId of dependents) {
        const current = inDegree.get(depId) || 0;
        inDegree.set(depId, current - 1);
        if (current - 1 === 0) {
          queue.push(depId);
        }
      }
    }

    return sorted;
  }

  /**
   * Group tasks by parallel execution
   */
  private groupByParallel(sorted: TaskNode[]): TaskNode[][] {
    const groups: TaskNode[][] = [];
    const completed = new Set<string>();

    let remaining = [...sorted];
    while (remaining.length > 0) {
      const group: TaskNode[] = [];
      const nextRemaining: TaskNode[] = [];

      for (const task of remaining) {
        const allDepsCompleted = task.dependencies.every((dep) => completed.has(dep));
        if (allDepsCompleted) {
          group.push(task);
        } else {
          nextRemaining.push(task);
        }
      }

      if (group.length === 0) {
        // Deadlock or error
        throw new Error('Cannot group tasks: possible deadlock');
      }

      groups.push(group);
      for (const task of group) {
        completed.add(task.id);
      }
      remaining = nextRemaining;
    }

    return groups;
  }

  /**
   * Calculate critical path
   */
  private calculateCriticalPath(): string[] {
    const path: string[] = [];
    const visited = new Set<string>();

    // Find root nodes
    const roots: string[] = [];
    for (const [nodeId, node] of this.graph.nodes.entries()) {
      if (node.dependencies.length === 0) {
        roots.push(nodeId);
      }
    }

    // Find longest path from any root
    let longestPath: string[] = [];
    for (const root of roots) {
      const currentPath = this.findLongestPath(root, visited);
      if (currentPath.length > longestPath.length) {
        longestPath = currentPath;
      }
    }

    return longestPath;
  }

  /**
   * Find longest path from a node
   */
  private findLongestPath(nodeId: string, visited: Set<string>): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const dependents = this.graph.edges.get(nodeId) || new Set();
    if (dependents.size === 0) {
      return [nodeId];
    }

    let longestPath: string[] = [];
    for (const depId of dependents) {
      const path = this.findLongestPath(depId, new Set(visited));
      if (path.length > longestPath.length) {
        longestPath = path;
      }
    }

    return [nodeId, ...longestPath];
  }

  /**
   * Calculate total duration
   */
  private calculateTotalDuration(groups: TaskNode[][]): number {
    let total = 0;
    for (const group of groups) {
      // Parallel tasks take max duration
      const maxDuration = Math.max(...group.map((t) => t.estimatedDuration || 1));
      total += maxDuration;
    }
    return total;
  }

  /**
   * Get graph
   */
  getGraph(): TaskGraph {
    return this.graph;
  }

  /**
   * Get stats
   */
  getStats(): {
    totalTasks: number;
    totalEdges: number;
    maxDepth: number;
    hasCycle: boolean;
    depthDistribution: Map<number, number>;
  } {
    return {
      totalTasks: this.graph.nodes.size,
      totalEdges: Array.from(this.graph.edges.values()).reduce((sum, edges) => sum + edges.size, 0),
      maxDepth: this.depthChecker.calculateMaxDepth(this.graph),
      hasCycle: CycleDetector.hasCycle(this.graph),
      depthDistribution: this.depthChecker.getDepthDistribution(this.graph),
    };
  }

  /**
   * Clear graph
   */
  clear(): void {
    this.graph = { nodes: new Map(), edges: new Map() };
  }
}
