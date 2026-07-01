// Self-Healing Types
import { v4 as uuidv4 } from 'uuid';

// ==================== Metrics ====================

export interface SystemMetrics {
  timestamp: number;
  taskManager: TaskManagerMetrics;
  agentPool: AgentPoolMetrics;
  eventBus: EventBusMetrics;
}

export interface TaskManagerMetrics {
  queueSize: number;
  retryCount: number;
  deadLetterCount: number;
  avgLatency: number;
  totalCompleted: number;
  totalFailed: number;
}

export interface AgentPoolMetrics {
  totalAgents: number;
  errorAgents: number;
  idleAgents: number;
  workingAgents: number;
  errorRate: number;
}

export interface EventBusMetrics {
  eventCount: number;
}

// ==================== Anomaly ====================

export type ComponentType = 'task_manager' | 'agent_pool' | 'event_bus' | 'persistence';
export type Severity = 'warning' | 'critical';
export type RootCause = 'queue_backlog' | 'agent_failure' | 'high_latency' | 'retry_storm' | 'resource_exhaustion' | 'unknown';

export interface Anomaly {
  id: string;
  component: ComponentType;
  metric: string;
  value: number;
  threshold: number;
  severity: Severity;
  timestamp: number;
}

export interface Diagnosis {
  anomalyId: string;
  rootCause: RootCause;
  confidence: number;
  description: string;
  recommendedActions: string[];
}

// ==================== Healing Action ====================

export interface HealingAction {
  name: string;
  description: string;
  cooldownMs: number;        // min time between same action
  maxRetries: number;        // max retries per incident
  execute: () => Promise<ActionResult>;
}

export interface ActionResult {
  success: boolean;
  actionName: string;
  before: Record<string, number>;
  after: Record<string, number>;
  timestamp: number;
  error?: string;
}

// ==================== Healing Log ====================

export interface HealingLog {
  id: string;
  anomalyId: string;
  diagnosis: RootCause;
  action: string;
  before: Record<string, number>;
  after: Record<string, number>;
  success: boolean;
  effectiveness: number;    // 0-1, calculated after action
  dryRun: boolean;
  timestamp: number;
}

// ==================== Alert ====================

export interface HealingAlert {
  id: string;
  anomalyId: string;
  diagnosis: RootCause;
  message: string;
  metrics: SystemMetrics;
  timestamp: number;
}

// ==================== Config ====================

export interface SelfHealerConfig {
  tickIntervalMs: number;
  dryRun: boolean;
  thresholds: ThresholdConfig;
}

export interface ThresholdConfig {
  queueSizeCritical: number;
  queueSizeWarning: number;
  errorRateCritical: number;
  errorRateWarning: number;
  latencyWarning: number;
  retryCountWarning: number;
  deadLetterWarning: number;
}

// ==================== Effectiveness Record ====================

export interface EffectivenessRecord {
  actionName: string;
  rootCause: RootCause;
  success: boolean;
  effectiveness: number;
  timestamp: number;
}

// ==================== Factory helpers ====================

export function createAnomaly(
  component: ComponentType,
  metric: string,
  value: number,
  threshold: number,
  severity: Severity
): Anomaly {
  return {
    id: uuidv4(),
    component,
    metric,
    value,
    threshold,
    severity,
    timestamp: Date.now(),
  };
}

export function createHealingLog(
  anomalyId: string,
  diagnosis: RootCause,
  action: string,
  before: Record<string, number>,
  after: Record<string, number>,
  success: boolean,
  effectiveness: number,
  dryRun: boolean
): HealingLog {
  return {
    id: uuidv4(),
    anomalyId,
    diagnosis,
    action,
    before,
    after,
    success,
    effectiveness,
    dryRun,
    timestamp: Date.now(),
  };
}