// Agent Scheduler — Agent OS v6.1
import { ScheduledTask, Priority, SchedulerStats } from './types';
import { PriorityQueue } from './priority-queue';
import { DeadlockDetector } from './deadlock-detector';
import { StarvationPreventer } from './starvation-preventer';
import { LoadBalancer } from './load-balancer';

export interface SchedulerConfig {
  maxWaitTime?: number;
  agingThreshold?: number;
  loadBalancingStrategy?: 'round-robin' | 'least-connection' | 'resource-aware';
}

export class AgentScheduler {
  private queue: PriorityQueue;
  private deadlockDetector: DeadlockDetector;
  private starvationPreventer: StarvationPreventer;
  private loadBalancer: LoadBalancer;
  private activeTasks: Map<string, ScheduledTask> = new Map();
  private completedTasks: ScheduledTask[] = [];
  private failedTasks: ScheduledTask[] = [];
  private totalScheduled: number = 0;

  constructor(config: SchedulerConfig = {}) {
    this.queue = new PriorityQueue();
    this.deadlockDetector = new DeadlockDetector(config.maxWaitTime);
    this.starvationPreventer = new StarvationPreventer(config.maxWaitTime);
    this.loadBalancer = new LoadBalancer(config.loadBalancingStrategy);
  }

  /**
   * Register agent
   */
  registerAgent(agentId: string): void {
    this.starvationPreventer.register(agentId);
    this.loadBalancer.register(agentId);
  }

  /**
   * Unregister agent
   */
  unregisterAgent(agentId: string): void {
    this.loadBalancer.unregister(agentId);
    this.deadlockDetector.removeAgent(agentId);
  }

  /**
   * Schedule a task
   */
  schedule(task: Omit<ScheduledTask, 'id' | 'createdAt'>): ScheduledTask {
    const scheduledTask: ScheduledTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };

    // Check for cycles in dependencies
    if (scheduledTask.dependencies.length > 0) {
      // Add edges to deadlock detector
      for (const dep of scheduledTask.dependencies) {
        this.deadlockDetector.addEdge(scheduledTask.agentId, dep);
      }

      // Check for deadlock
      if (this.deadlockDetector.isDeadlocked(scheduledTask.agentId)) {
        // Break deadlock
        const toKill = this.deadlockDetector.breakDeadlock();
        if (toKill) {
          this.killTask(toKill);
        }
      }
    }

    // Boost priority if starved
    scheduledTask.priority = this.starvationPreventer.boostPriority(
      scheduledTask.priority,
      scheduledTask.agentId
    );

    // Add to queue
    this.queue.enqueue(scheduledTask);
    this.totalScheduled++;

    return scheduledTask;
  }

  /**
   * Assign next task to available agent
   */
  assignNext(): { task: ScheduledTask; agentId: string } | null {
    // Age priorities for waiting tasks
    this.queue.agePriorities();

    // Get next task
    const task = this.queue.peek();
    if (!task) return null;

    // Find available agent
    const agentId = this.loadBalancer.getNext();
    if (!agentId) return null;

    // Check dependencies
    if (task.dependencies.length > 0) {
      const allCompleted = task.dependencies.every((dep) =>
        this.completedTasks.some((t) => t.agentId === dep)
      );
      if (!allCompleted) {
        // Dependencies not met, try next task
        this.queue.dequeue();
        this.queue.enqueue(task); // Re-add at end
        return this.assignNext();
      }
    }

    // Assign task
    this.queue.dequeue();
    task.startedAt = Date.now();
    this.activeTasks.set(task.id, task);

    // Update scheduler state
    this.loadBalancer.markBusy(agentId, task.id);
    this.starvationPreventer.markBusy(agentId, task.id);

    return { task, agentId };
  }

  /**
   * Complete a task
   */
  complete(taskId: string, success: boolean): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.completedAt = Date.now();
    this.activeTasks.delete(taskId);

    if (success) {
      this.completedTasks.push(task);
      this.loadBalancer.markIdle(task.agentId, true);
      this.starvationPreventer.markIdle(task.agentId, true);
    } else {
      this.failedTasks.push(task);
      this.loadBalancer.markIdle(task.agentId, false);
      this.starvationPreventer.markIdle(task.agentId, false);
    }

    // Remove from deadlock detector
    this.deadlockDetector.removeAgent(task.agentId);

    // Update wait time
    if (task.startedAt) {
      const waitTime = task.startedAt - task.createdAt;
      this.starvationPreventer.updateWaitTime(task.agentId, waitTime);
    }
  }

  /**
   * Kill a task (for deadlock breaking)
   */
  killTask(agentId: string): void {
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.agentId === agentId) {
        this.complete(taskId, false);
        break;
      }
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size();
  }

  /**
   * Get stats
   */
  getStats(): SchedulerStats {
    const starvationStats = this.starvationPreventer.getStats();
    const loadStats = this.loadBalancer.getStats();
    const deadlockStats = this.deadlockDetector.getStats();

    return {
      queueSize: this.queue.size(),
      activeAgents: loadStats.busyAgents,
      idleAgents: loadStats.availableAgents,
      totalScheduled: this.totalScheduled,
      totalCompleted: this.completedTasks.length,
      totalFailed: this.failedTasks.length,
      averageWaitTime: starvationStats.averageWaitTime,
    };
  }

  /**
   * Get detailed stats
   */
  getDetailedStats(): {
    queue: ReturnType<PriorityQueue['getAll']>;
    active: Map<string, ScheduledTask>;
    completed: ScheduledTask[];
    failed: ScheduledTask[];
    deadlock: ReturnType<DeadlockDetector['getStats']>;
    starvation: ReturnType<StarvationPreventer['getStats']>;
    loadBalancer: ReturnType<LoadBalancer['getStats']>;
  } {
    return {
      queue: this.queue.getAll(),
      active: this.activeTasks,
      completed: this.completedTasks,
      failed: this.failedTasks,
      deadlock: this.deadlockDetector.getStats(),
      starvation: this.starvationPreventer.getStats(),
      loadBalancer: this.loadBalancer.getStats(),
    };
  }

  /**
   * Clear all
   */
  clear(): void {
    this.queue.clear();
    this.activeTasks.clear();
    this.completedTasks = [];
    this.failedTasks = [];
    this.deadlockDetector.clear();
    this.starvationPreventer.clear();
    this.loadBalancer.clear();
    this.totalScheduled = 0;
  }
}
