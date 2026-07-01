// Metrics Collector — Reads real metrics from existing components
import { TaskManager } from '../task/task-manager';
import { AgentPool } from '../agent/agent-pool';
import { EventBus } from '../../event/bus';
import {
  SystemMetrics,
  TaskManagerMetrics,
  AgentPoolMetrics,
  EventBusMetrics,
} from './types';

export class MetricsCollector {
  private taskManager: TaskManager;
  private agentPool: AgentPool;
  private eventBus: EventBus;

  constructor(taskManager: TaskManager, agentPool: AgentPool, eventBus: EventBus) {
    this.taskManager = taskManager;
    this.agentPool = agentPool;
    this.eventBus = eventBus;
  }

  // Collect all metrics from real components
  async collect(): Promise<SystemMetrics> {
    return {
      timestamp: Date.now(),
      taskManager: this.collectTaskManagerMetrics(),
      agentPool: this.collectAgentPoolMetrics(),
      eventBus: await this.collectEventBusMetrics(),
    };
  }

  // Read TaskManager metrics (real data only)
  private collectTaskManagerMetrics(): TaskManagerMetrics {
    const allTasks = this.taskManager.getAllTasks();
    const completedTasks = allTasks.filter(t => t.status === 'completed' && t.startedAt && t.completedAt);
    const failedTasks = allTasks.filter(t => t.status === 'failed');
    const retryTasks = allTasks.filter(t => t.retryCount > 0);
    const deadLetterTasks = allTasks.filter(t => t.status === 'dead_letter');

    // Calculate average latency from completed tasks
    let avgLatency = 0;
    if (completedTasks.length > 0) {
      const totalLatency = completedTasks.reduce((sum, t) => {
        return sum + ((t.completedAt || 0) - (t.startedAt || 0));
      }, 0);
      avgLatency = totalLatency / completedTasks.length;
    }

    return {
      queueSize: this.taskManager.getQueueSize(),
      retryCount: retryTasks.length,
      deadLetterCount: deadLetterTasks.length,
      avgLatency: Math.round(avgLatency),
      totalCompleted: completedTasks.length,
      totalFailed: failedTasks.length,
    };
  }

  // Read AgentPool metrics (real data only)
  private collectAgentPoolMetrics(): AgentPoolMetrics {
    const agents = this.agentPool.getAllAgents();
    const totalCompleted = agents.reduce((sum, a) => sum + a.totalCompleted, 0);
    const totalFailed = agents.reduce((sum, a) => sum + a.totalFailed, 0);

    return {
      totalAgents: agents.length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      workingAgents: agents.filter(a => a.status === 'working').length,
      errorRate: (totalCompleted + totalFailed) > 0
        ? totalFailed / (totalCompleted + totalFailed)
        : 0,
    };
  }

  // Read EventBus metrics (real data only)
  private async collectEventBusMetrics(): Promise<EventBusMetrics> {
    // Count events from event store
    // Note: eventStore.query({}) returns all events
    const events = await (this.eventBus as any).eventStore?.query({}) || [];
    return {
      eventCount: events.length,
    };
  }
}