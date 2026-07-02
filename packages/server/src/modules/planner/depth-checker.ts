// Depth Checker — Agent OS v6.1
import { TaskGraph, TaskNode } from './types';

export class DepthChecker {
  private readonly maxDepth: number;

  constructor(maxDepth: number = 5) {
    this.maxDepth = maxDepth;
  }

  /**
   * Calculate depth of a node (longest path from root)
   */
  calculateDepth(nodeId: string, graph: TaskGraph, visited: Map<string, number> = new Map()): number {
    if (visited.has(nodeId)) {
      return visited.get(nodeId)!;
    }

    const node = graph.nodes.get(nodeId);
    if (!node || node.dependencies.length === 0) {
      visited.set(nodeId, 0);
      return 0;
    }

    let maxDepDepth = 0;
    for (const depId of node.dependencies) {
      const depDepth = this.calculateDepth(depId, graph, visited);
      maxDepDepth = Math.max(maxDepDepth, depDepth);
    }

    const depth = maxDepDepth + 1;
    visited.set(nodeId, depth);
    return depth;
  }

  /**
   * Calculate max depth of entire graph
   */
  calculateMaxDepth(graph: TaskGraph): number {
    const visited = new Map<string, number>();
    let maxDepth = 0;

    for (const nodeId of graph.nodes.keys()) {
      const depth = this.calculateDepth(nodeId, graph, visited);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Check if graph exceeds max depth
   */
  exceedsMaxDepth(graph: TaskGraph): boolean {
    return this.calculateMaxDepth(graph) > this.maxDepth;
  }

  /**
   * Get nodes at specific depth
   */
  getNodesAtDepth(depth: number, graph: TaskGraph): TaskNode[] {
    const visited = new Map<string, number>();
    const nodes: TaskNode[] = [];

    for (const [nodeId, node] of graph.nodes.entries()) {
      const nodeDepth = this.calculateDepth(nodeId, graph, visited);
      if (nodeDepth === depth) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * Get depth distribution
   */
  getDepthDistribution(graph: TaskGraph): Map<number, number> {
    const visited = new Map<string, number>();
    const distribution = new Map<number, number>();

    for (const nodeId of graph.nodes.keys()) {
      const depth = this.calculateDepth(nodeId, graph, visited);
      distribution.set(depth, (distribution.get(depth) || 0) + 1);
    }

    return distribution;
  }

  /**
   * Flatten graph to reduce depth
   * Returns list of tasks that can be run in parallel
   */
  flatten(graph: TaskGraph): TaskNode[][] {
    const visited = new Set<string>();
    const layers: TaskNode[][] = [];

    // Find root nodes (no dependencies)
    const roots: string[] = [];
    for (const [nodeId, node] of graph.nodes.entries()) {
      if (node.dependencies.length === 0) {
        roots.push(nodeId);
      }
    }

    // BFS to create layers
    let currentLayer = roots;
    while (currentLayer.length > 0) {
      const layerNodes = currentLayer
        .map((id) => graph.nodes.get(id))
        .filter((n): n is TaskNode => n !== undefined);
      layers.push(layerNodes);

      for (const id of currentLayer) {
        visited.add(id);
      }

      // Find next layer (nodes whose dependencies are all visited)
      const nextLayer: string[] = [];
      for (const [nodeId, node] of graph.nodes.entries()) {
        if (visited.has(nodeId)) continue;
        if (node.dependencies.every((dep) => visited.has(dep))) {
          nextLayer.push(nodeId);
        }
      }

      currentLayer = nextLayer;
    }

    return layers;
  }

  /**
   * Get max depth config
   */
  getMaxDepth(): number {
    return this.maxDepth;
  }
}
