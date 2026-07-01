// Detector — Identifies anomalies from metrics
import {
  SystemMetrics,
  Anomaly,
  Severity,
  ThresholdConfig,
  createAnomaly,
} from './types';

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  queueSizeCritical: 50,
  queueSizeWarning: 20,
  errorRateCritical: 0.5,
  errorRateWarning: 0.3,
  latencyWarning: 30000,
  retryCountWarning: 10,
  deadLetterWarning: 5,
};

export class Detector {
  private thresholds: ThresholdConfig;

  constructor(thresholds?: Partial<ThresholdConfig>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  // Detect all anomalies from current metrics
  detect(metrics: SystemMetrics): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // TaskManager checks
    anomalies.push(...this.detectTaskManagerAnomalies(metrics));

    // AgentPool checks
    anomalies.push(...this.detectAgentPoolAnomalies(metrics));

    return anomalies;
  }

  private detectTaskManagerAnomalies(metrics: SystemMetrics): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const tm = metrics.taskManager;

    // Queue size
    if (tm.queueSize > this.thresholds.queueSizeCritical) {
      anomalies.push(createAnomaly('task_manager', 'queueSize', tm.queueSize, this.thresholds.queueSizeCritical, 'critical'));
    } else if (tm.queueSize > this.thresholds.queueSizeWarning) {
      anomalies.push(createAnomaly('task_manager', 'queueSize', tm.queueSize, this.thresholds.queueSizeWarning, 'warning'));
    }

    // Dead letters
    if (tm.deadLetterCount > this.thresholds.deadLetterWarning) {
      anomalies.push(createAnomaly('task_manager', 'deadLetterCount', tm.deadLetterCount, this.thresholds.deadLetterWarning, 'warning'));
    }

    // Retry count
    if (tm.retryCount > this.thresholds.retryCountWarning) {
      anomalies.push(createAnomaly('task_manager', 'retryCount', tm.retryCount, this.thresholds.retryCountWarning, 'warning'));
    }

    // Latency
    if (tm.avgLatency > this.thresholds.latencyWarning) {
      anomalies.push(createAnomaly('task_manager', 'avgLatency', tm.avgLatency, this.thresholds.latencyWarning, 'warning'));
    }

    return anomalies;
  }

  private detectAgentPoolAnomalies(metrics: SystemMetrics): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const ap = metrics.agentPool;

    // Error rate
    if (ap.errorRate > this.thresholds.errorRateCritical) {
      anomalies.push(createAnomaly('agent_pool', 'errorRate', ap.errorRate, this.thresholds.errorRateCritical, 'critical'));
    } else if (ap.errorRate > this.thresholds.errorRateWarning) {
      anomalies.push(createAnomaly('agent_pool', 'errorRate', ap.errorRate, this.thresholds.errorRateWarning, 'warning'));
    }

    // Error agents
    if (ap.errorAgents > 0) {
      anomalies.push(createAnomaly('agent_pool', 'errorAgents', ap.errorAgents, 0, 'warning'));
    }

    // Resource exhaustion: no idle agents but queue has tasks
    if (ap.idleAgents === 0 && ap.totalAgents > 0) {
      anomalies.push(createAnomaly('agent_pool', 'idleAgents', 0, 1, 'warning'));
    }

    return anomalies;
  }

  // Update thresholds at runtime
  updateThresholds(partial: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...partial };
  }

  getThresholds(): ThresholdConfig {
    return { ...this.thresholds };
  }
}