// api.ts — API Client with env vars for production
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  requiredSkills: string[];
  assignedAgentId?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  result?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  status: string;
  currentTaskId?: string;
  healthScore: number;
  lastHeartbeat: number;
  totalCompleted: number;
  totalFailed: number;
  createdAt: number;
}

export interface HealthStatus {
  status: string;
  timestamp: number;
  version: string;
  persistence: string;
  modules: {
    orchestrator: { queueSize: number; agents: { total: number; idle: number; working: number; error: number; offline: number } };
    memory: { working: number; longterm: number; vector: number; total: number };
    skills: { totalSkills: number; avgHealthScore: number };
    learning: { totalTasksAnalyzed: number; patternsDetected: number; lessonsGenerated: number };
    improvement: { metricsCollected: number; avgHealth: number };
    selfHealer: { isRunning: boolean; dryRun: boolean; totalHealings: number; successRate: number };
  };
  websocket: number;
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/api/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

export async function createTask(title: string, description?: string, skills: string[] = []): Promise<Task> {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, requiredSkills: skills, priority: 5 }),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export { API_BASE, WS_URL };