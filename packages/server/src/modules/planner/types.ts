// Planner Types — Agent OS v6.1

export interface TaskNode {
  id: string;
  name: string;
  type: string;
  dependencies: string[];
  priority: number;
  estimatedDuration?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskGraph {
  nodes: Map<string, TaskNode>;
  edges: Map<string, Set<string>>; // adjacency list
}

export interface ExecutionPlan {
  tasks: TaskNode[];
  parallelGroups: TaskNode[][];
  totalDuration: number;
  criticalPath: string[];
}

export interface PlannerConfig {
  maxDepth: number;
  maxTasks: number;
  cycleDetectionEnabled: boolean;
}
