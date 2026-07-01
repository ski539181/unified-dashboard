// Diagnoser — Analyzes root cause from anomalies
import { Anomaly, Diagnosis, RootCause, SystemMetrics } from './types';

export class Diagnoser {
  // Diagnose root cause from a single anomaly
  diagnose(anomaly: Anomaly, metrics: SystemMetrics): Diagnosis {
    const rootCause = this.determineRootCause(anomaly, metrics);
    const confidence = this.calculateConfidence(anomaly, rootCause);
    const description = this.generateDescription(rootCause, anomaly);
    const recommendedActions = this.getRecommendedActions(rootCause);

    return {
      anomalyId: anomaly.id,
      rootCause,
      confidence,
      description,
      recommendedActions,
    };
  }

  // Diagnose from multiple anomalies (combined analysis)
  diagnoseMultiple(anomalies: Anomaly[], metrics: SystemMetrics): Diagnosis[] {
    return anomalies.map(a => this.diagnose(a, metrics));
  }

  private determineRootCause(anomaly: Anomaly, metrics: SystemMetrics): RootCause {
    const tm = metrics.taskManager;
    const ap = metrics.agentPool;

    // Queue backlog indicators
    if (anomaly.component === 'task_manager') {
      if (anomaly.metric === 'queueSize' && anomaly.value > 20) {
        return 'queue_backlog';
      }
      if (anomaly.metric === 'deadLetterCount' && anomaly.value > 5) {
        return 'queue_backlog';
      }
      if (anomaly.metric === 'retryCount' && anomaly.value > 10) {
        return 'retry_storm';
      }
      if (anomaly.metric === 'avgLatency' && anomaly.value > 30000) {
        return 'high_latency';
      }
    }

    // Agent failure indicators
    if (anomaly.component === 'agent_pool') {
      if (anomaly.metric === 'errorRate' && anomaly.value > 0.3) {
        return 'agent_failure';
      }
      if (anomaly.metric === 'errorAgents' && anomaly.value > 0) {
        return 'agent_failure';
      }
      if (anomaly.metric === 'idleAgents' && anomaly.value === 0 && tm.queueSize > 0) {
        return 'resource_exhaustion';
      }
    }

    return 'unknown';
  }

  private calculateConfidence(anomaly: Anomaly, rootCause: RootCause): number {
    // Higher severity = higher confidence
    const severityBoost = anomaly.severity === 'critical' ? 0.3 : 0.1;

    // Known patterns have higher confidence
    const patternConfidence: Record<RootCause, number> = {
      queue_backlog: 0.8,
      agent_failure: 0.85,
      high_latency: 0.7,
      retry_storm: 0.75,
      resource_exhaustion: 0.8,
      unknown: 0.3,
    };

    const base = patternConfidence[rootCause] || 0.3;
    return Math.min(1.0, base + severityBoost);
  }

  private generateDescription(rootCause: RootCause, anomaly: Anomaly): string {
    const descriptions: Record<RootCause, string> = {
      queue_backlog: `Queue backlog detected: ${anomaly.metric} = ${anomaly.value} (threshold: ${anomaly.threshold})`,
      agent_failure: `Agent failure detected: ${anomaly.metric} = ${anomaly.value} (threshold: ${anomaly.threshold})`,
      high_latency: `High latency detected: ${anomaly.metric} = ${anomaly.value}ms (threshold: ${anomaly.threshold}ms)`,
      retry_storm: `Retry storm detected: ${anomaly.metric} = ${anomaly.value} (threshold: ${anomaly.threshold})`,
      resource_exhaustion: `Resource exhaustion: no idle agents with pending tasks`,
      unknown: `Unknown issue: ${anomaly.component}.${anomaly.metric} = ${anomaly.value}`,
    };
    return descriptions[rootCause];
  }

  private getRecommendedActions(rootCause: RootCause): string[] {
    const actionMap: Record<RootCause, string[]> = {
      queue_backlog: ['clearDeadLetters'],
      agent_failure: ['restartErrorAgents'],
      high_latency: ['reduceSendRate'],
      retry_storm: ['enableBackpressure'],
      resource_exhaustion: ['enableBackpressure', 'restartErrorAgents'],
      unknown: ['alert'],
    };
    return actionMap[rootCause];
  }
}