// Cycle Detector — Agent OS v6.1
import { TaskGraph } from './types';

export class CycleDetector {
  /**
   * Detect cycles in task graph using DFS
   */
  static detect(graph: TaskGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.edges.get(nodeId) || new Set();
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
      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Check if graph has cycles
   */
  static hasCycle(graph: TaskGraph): boolean {
    return CycleDetector.detect(graph).length > 0;
  }

  /**
   * Find the weakest link in a cycle to break
   */
  static findWeakestLink(cycle: string[], graph: TaskGraph): string {
    // Find node with most dependencies (weakest)
    let maxDeps = -1;
    let weakest = cycle[0];

    for (const nodeId of cycle) {
      const node = graph.nodes.get(nodeId);
      if (node && node.dependencies.length > maxDeps) {
        maxDeps = node.dependencies.length;
        weakest = nodeId;
      }
    }

    return weakest;
  }

  /**
   * Break cycle by removing weakest link
   */
  static breakCycle(graph: TaskGraph): { broken: boolean; removedEdge?: string } {
    const cycles = CycleDetector.detect(graph);
    if (cycles.length === 0) {
      return { broken: false };
    }

    // Break the first cycle found
    const cycle = cycles[0];
    const weakest = CycleDetector.findWeakestLink(cycle, graph);

    // Remove the edge from weakest to its predecessor in cycle
    const cycleIndex = cycle.indexOf(weakest);
    const predecessor = cycle[(cycleIndex - 1 + cycle.length) % cycle.length];

    const edges = graph.edges.get(predecessor);
    if (edges) {
      edges.delete(weakest);
    }

    return { broken: true, removedEdge: `${predecessor} -> ${weakest}` };
  }
}
