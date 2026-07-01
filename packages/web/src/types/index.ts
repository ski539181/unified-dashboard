// Shared TypeScript types for Unified Dashboard

// Task Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  requiredSkills: string[];
  assignedAgentId?: string;
  retryCount: number;
  maxRetries: number;
  result?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type TaskStatus = 
  | 'created'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead_letter';

// Agent Types
export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  currentTaskId?: string;
  healthScore: number;
  lastHeartbeat: number;
  totalCompleted: number;
  totalFailed: number;
}

export type AgentStatus = 
  | 'offline'
  | 'registering'
  | 'idle'
  | 'working'
  | 'paused'
  | 'completed'
  | 'error';

// Event Types
export interface Event {
  id: string;
  type: string;
  version: number;
  timestamp: number;
  source: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

// Stats Types
export interface SystemStats {
  queueSize: number;
  agents: {
    total: number;
    idle: number;
    working: number;
    error: number;
    offline: number;
  };
}

// WebSocket Message Types
export interface WSMessage {
  type: 'event' | 'error' | 'connected';
  data?: Event;
  error?: string;
}
