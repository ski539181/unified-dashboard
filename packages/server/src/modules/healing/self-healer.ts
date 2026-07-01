// Self-Healer Engine — Uses ControlLayer for safe mutations
import { TaskManager } from '../task/task-manager';
import { AgentPool } from '../agent/agent-pool';
import { Orchestrator } from '../orchestrator/orchestrator';
import { EventBus } from '../../event/bus';
import { MetricsCollector } from './metrics-collector';
import { Detector } from './detector';
import { Diagnoser } from './diagnoser';
import { HealingActions } from './actions';
import { Learner } from './learner';
import { ControlLayer } from './control-layer';
import {
  SelfHealerConfig,
  SystemMetrics,
  Anomaly,
  Diagnosis,
  HealingLog,
  HealingAlert,
  createHealingLog,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// Cooldown tracker
const actionCooldowns = new Map<string, number>();
const incidentRetries = new Map<string, number>();

export class SelfHealer {
  private metricsCollector: MetricsCollector;
  private detector: Detector;
  private diagnoser: Diagnoser;
  private actions: HealingActions;
  private learner: Learner;
  private controlLayer: ControlLayer;
  private eventBus: EventBus;
  private config: SelfHealerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private healingLogs: HealingLog[] = [];

  constructor(
    taskManager: TaskManager,
    agentPool: AgentPool,
    orchestrator: Orchestrator,
    eventBus: EventBus,
    config?: Partial<SelfHealerConfig>
  ) {
    this.metricsCollector = new MetricsCollector(taskManager, agentPool, eventBus);
    this.detector = new Detector(config?.thresholds);
    this.diagnoser = new Diagnoser();
    this.controlLayer = new ControlLayer(taskManager, agentPool, orchestrator, eventBus);
    this.actions = new HealingActions(this.controlLayer);
    this.learner = new Learner();
    this.eventBus = eventBus;
    this.config = {
      tickIntervalMs: config?.tickIntervalMs || 5000,
      dryRun: config?.dryRun || false,
      thresholds: config?.thresholds || {} as any,
    };
  }

  start(intervalMs?: number): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const interval = intervalMs || this.config.tickIntervalMs;
    this.intervalId = setInterval(() => this.tick(), interval);
    console.log(`🛡️ Self-Healer started (interval: ${interval}ms, dryRun: ${this.config.dryRun})`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛡️ Self-Healer stopped');
  }

  setDryRun(enabled: boolean): void {
    this.config.dryRun = enabled;
    console.log(`🛡️ Self-Healer dry-run: ${enabled ? 'ON' : 'OFF'}`);
  }

  private async tick(): Promise<void> {
    try {
      const metrics = await this.metricsCollector.collect();
      const anomalies = this.detector.detect(metrics);
      if (anomalies.length === 0) return;

      const diagnoses = this.diagnoser.diagnoseMultiple(anomalies, metrics);
      for (const diagnosis of diagnoses) {
        await this.heal(diagnosis, metrics);
      }
    } catch (error) {
      console.error('🛡️ Self-Healer tick error:', error);
    }
  }

  private async heal(diagnosis: Diagnosis, metrics: SystemMetrics): Promise<void> {
    const anomalyId = diagnosis.anomalyId;

    const currentRetries = incidentRetries.get(anomalyId) || 0;
    if (currentRetries >= 3) {
      await this.createAlert(anomalyId, diagnosis, metrics);
      return;
    }

    const recommendedAction = this.learner.getBestAction(diagnosis.rootCause);
    const actionName = recommendedAction || diagnosis.recommendedActions[0];

    if (!actionName || actionName === 'alert') {
      await this.createAlert(anomalyId, diagnosis, metrics);
      return;
    }

    const action = this.actions.getAction(actionName);
    if (!action) {
      await this.createAlert(anomalyId, diagnosis, metrics);
      return;
    }

    const lastExecution = actionCooldowns.get(actionName) || 0;
    if (Date.now() - lastExecution < action.cooldownMs) {
      console.log(`🛡️ Action ${actionName} on cooldown, skipping`);
      return;
    }

    incidentRetries.set(anomalyId, currentRetries + 1);

    let result;
    if (this.config.dryRun) {
      result = {
        success: true,
        actionName,
        before: {},
        after: {},
        timestamp: Date.now(),
      };
      console.log(`🛡️ [DRY-RUN] Would execute: ${actionName}`);
    } else {
      try {
        result = await action.execute();
        actionCooldowns.set(actionName, Date.now());
      } catch (error) {
        result = {
          success: false,
          actionName,
          before: {},
          after: {},
          timestamp: Date.now(),
          error: (error as Error).message,
        };
      }
    }

    const effectiveness = this.learner.calculateEffectiveness(
      result.before,
      result.after,
      actionName
    );

    const log = createHealingLog(
      anomalyId,
      diagnosis.rootCause,
      actionName,
      result.before,
      result.after,
      result.success,
      effectiveness,
      this.config.dryRun
    );

    this.healingLogs.push(log);

    this.learner.record({
      actionName,
      rootCause: diagnosis.rootCause,
      success: result.success,
      effectiveness,
      timestamp: Date.now(),
    });

    await this.eventBus.emit('healing:action_executed', {
      logId: log.id,
      action: actionName,
      diagnosis: diagnosis.rootCause,
      success: result.success,
      effectiveness,
      dryRun: this.config.dryRun,
    }, 'self-healer').catch(() => {});

    console.log(`🛡️ Healing: ${actionName} → ${result.success ? '✅' : '❌'} (effectiveness: ${(effectiveness * 100).toFixed(1)}%)`);
  }

  private async createAlert(
    anomalyId: string,
    diagnosis: Diagnosis,
    metrics: SystemMetrics
  ): Promise<void> {
    const alert: HealingAlert = {
      id: uuidv4(),
      anomalyId,
      diagnosis: diagnosis.rootCause,
      message: `Auto-healing failed for ${diagnosis.rootCause}. Manual intervention required.`,
      metrics,
      timestamp: Date.now(),
    };

    await this.eventBus.emit('healing:alert', {
      alertId: alert.id,
      diagnosis: alert.diagnosis,
      message: alert.message,
    }, 'self-healer').catch(() => {});

    console.log(`🚨 ALERT: ${alert.message}`);
  }

  getStatus(): {
    isRunning: boolean;
    dryRun: boolean;
    totalHealings: number;
    successRate: number;
    avgEffectiveness: number;
  } {
    const logs = this.healingLogs;
    const successes = logs.filter(l => l.success);

    return {
      isRunning: this.isRunning,
      dryRun: this.config.dryRun,
      totalHealings: logs.length,
      successRate: logs.length > 0 ? successes.length / logs.length : 0,
      avgEffectiveness: logs.length > 0
        ? logs.reduce((sum, l) => sum + l.effectiveness, 0) / logs.length
        : 0,
    };
  }

  getLogs(): HealingLog[] {
    return [...this.healingLogs];
  }

  getLearner(): Learner {
    return this.learner;
  }

  getDetector(): Detector {
    return this.detector;
  }

  getControlLayer(): ControlLayer {
    return this.controlLayer;
  }
}