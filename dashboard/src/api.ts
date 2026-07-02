// API Client — Connects to real backend
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3001";

// ==================== Types ====================

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
  status: string;
  capabilities: string[];
  healthScore: number;
  currentTaskId?: string;
  totalCompleted: number;
  totalFailed: number;
  lastHeartbeat: number;
  createdAt: number;
}

export interface Event {
  id: string;
  type: string;
  timestamp: number;
  source: string;
  payload: Record<string, unknown>;
  version: number;
  correlationId?: string;
}

export interface SystemHealth {
  cpu: { model: string; cores: number; usage: number; loadAvg: number[] };
  memory: { total: number; free: number; used: number; usagePercent: number };
  uptime: number;
  platform: string;
  nodeVersion: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  severity: 'error' | 'warning' | 'info';
}

// ==================== API Functions ====================

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Failed to fetch health");
  return res.json();
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/api/tasks`);
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/agents`);
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function fetchEvents(limit: number = 50): Promise<Event[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/events/recent?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/api/dashboard/system/health`);
  if (!res.ok) throw new Error("Failed to fetch system health");
  return res.json();
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/notifications`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function fetchMemoryStats(): Promise<{ working: number; longterm: number; vector: number; total: number }> {
  const res = await fetch(`${API_BASE}/api/intelligence/memory/stats`);
  if (!res.ok) throw new Error("Failed to fetch memory stats");
  return res.json();
}

export async function fetchSkills(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/intelligence/skills`);
  if (!res.ok) throw new Error("Failed to fetch skills");
  return res.json();
}

export async function fetchLearningMetrics(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/intelligence/learning/metrics`);
  if (!res.ok) throw new Error("Failed to fetch learning metrics");
  return res.json();
}

// ==================== WebSocket ====================

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export function createWebSocket(onMessage: (msg: WSMessage) => void): WebSocket {
  const ws = new WebSocket(WS_URL.replace('http', 'ws').replace(':3001', ':3001/socket.io/?EIO=4&transport=websocket'));
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'event') {
        onMessage(data);
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
}

export { API_BASE, WS_URL };
