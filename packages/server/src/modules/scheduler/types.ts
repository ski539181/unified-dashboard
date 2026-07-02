// Scheduler Types — Agent OS v6.1

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface ScheduledTask {
  id: string;
  agentId: string;
  priority: Priority;
  payload: unknown;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  timeout: number;
  dependencies: string[];
}

export interface AgentStatus {
  id: string;
  busy: boolean;
  currentTask?: string;
  completedTasks: number;
  failedTasks: number;
  totalWaitTime: number;
  lastActive: number;
}

export interface WaitForEdge {
  from: string; // agent waiting
  to: string;   // agent holding resource
}

export interface SchedulerStats {
  queueSize: number;
  activeAgents: number;
  idleAgents: number;
  totalScheduled: number;
  totalCompleted: number;
  totalFailed: number;
  averageWaitTime: number;
}
