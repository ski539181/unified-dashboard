// Control Layer — Safe mutation interface for core modules
// All mutations go through controlled APIs with safety checks
import { TaskManager, Task } from '../task/task-manager';
import { AgentPool, Agent } from '../agent/agent-pool';
import { Orchestrator } from '../orchestrator/orchestrator';
import { EventBus } from '../../event/bus';

// ==================== Types ====================

export interface MutationResult {
  success: boolean;
  action: string;
  before: Record<string, number>;
  after: Record<string, number>;
  rollback?: () => Promise<void>;
  error?: string;
}

export interface SafetyCheck {
  name: string;
  check: (metrics: Record<string, number>) => boolean;
  message: string;
}

// ==================== Task Manager Control ====================

export class TaskManagerControl {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  // Safe: remove dead letter tasks with rollback
  async clearDeadLetters(safetyChecks?: SafetyCheck[]): Promise<MutationResult> {
    const before = this.getMetrics();

    // Safety checks
    if (safetyChecks) {
      for (const check of safetyChecks) {
        if (!check.check(before)) {
          return { success: false, action: 'clearDeadLetters', before, after: before, error: `Safety check failed: ${check.message}` };
        }
      }
    }

    // Record state for rollback
    const tasksMap = (this.taskManager as any).tasks as Map<string, Task>;
    const deadLetterTasks: Task[] = [];
    const entries = Array.from(tasksMap.entries());
    for (const [id, task] of entries) {
      if (task.status === 'dead_letter') {
        deadLetterTasks.push({ ...task });
      }
    }

    // Execute mutation
    for (const task of deadLetterTasks) {
      tasksMap.delete(task.id);
    }

    const after = this.getMetrics();

    // Rollback function
    const rollback = async () => {
      for (const task of deadLetterTasks) {
        tasksMap.set(task.id, task);
      }
    };

    return {
      success: deadLetterTasks.length > 0,
      action: 'clearDeadLetters',
      before,
      after,
      rollback,
    };
  }

  // Safe: increase timeout for queued tasks
  async reduceSendRate(safetyChecks?: SafetyCheck[]): Promise<MutationResult> {
    const before = this.getMetrics();

    if (safetyChecks) {
      for (const check of safetyChecks) {
        if (!check.check(before)) {
          return { success: false, action: 'reduceSendRate', before, after: before, error: `Safety check failed: ${check.message}` };
        }
      }
    }

    const tasksMap = (this.taskManager as any).tasks as Map<string, Task>;
    const originalTimeouts = new Map<string, number>();
    let updated = 0;

    const entries = Array.from(tasksMap.entries());
    for (const [id, task] of entries) {
      if (task.status === 'queued' || task.status === 'assigned') {
        originalTimeouts.set(id, task.timeoutMs);
        task.timeoutMs = task.timeoutMs * 2;
        updated++;
      }
    }

    const after = this.getMetrics();

    const rollback = async () => {
      const entries = Array.from(originalTimeouts.entries());
      for (const [id, originalTimeout] of entries) {
        const task = tasksMap.get(id);
        if (task) task.timeoutMs = originalTimeout;
      }
    };

    return {
      success: updated > 0,
      action: 'reduceSendRate',
      before,
      after,
      rollback,
    };
  }

  getMetrics(): Record<string, number> {
    const allTasks = this.taskManager.getAllTasks();
    return {
      queueSize: this.taskManager.getQueueSize(),
      deadLetterCount: allTasks.filter(t => t.status === 'dead_letter').length,
      retryCount: allTasks.filter(t => t.retryCount > 0).length,
      totalTasks: allTasks.length,
    };
  }
}

// ==================== Agent Pool Control ====================

export class AgentPoolControl {
  private agentPool: AgentPool;

  constructor(agentPool: AgentPool) {
    this.agentPool = agentPool;
  }

  // Safe: transition error agents to idle with rollback
  async restartErrorAgents(safetyChecks?: SafetyCheck[]): Promise<MutationResult> {
    const before = this.getMetrics();

    if (safetyChecks) {
      for (const check of safetyChecks) {
        if (!check.check(before)) {
          return { success: false, action: 'restartErrorAgents', before, after: before, error: `Safety check failed: ${check.message}` };
        }
      }
    }

    const agentsMap = (this.agentPool as any).agents as Map<string, Agent>;
    const stateMachine = (this.agentPool as any).stateMachine;
    const originalStates: { id: string; agent: Agent }[] = [];
    const restartedIds: string[] = [];

    const entries = Array.from(agentsMap.entries());
    for (const [id, agent] of entries) {
      if (agent.status === 'error') {
        try {
          originalStates.push({ id, agent: { ...agent } });
          const updated = stateMachine.transition(agent, 'idle');
          updated.currentTaskId = undefined;
          agentsMap.set(id, updated);
          restartedIds.push(id);
        } catch (e) {
          // Transition not valid
        }
      }
    }

    const after = this.getMetrics();

    const rollback = async () => {
      for (const { id, agent } of originalStates) {
        agentsMap.set(id, agent);
      }
    };

    return {
      success: restartedIds.length > 0,
      action: 'restartErrorAgents',
      before,
      after,
      rollback,
    };
  }

  getMetrics(): Record<string, number> {
    const agents = this.agentPool.getAllAgents();
    return {
      totalAgents: agents.length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      workingAgents: agents.filter(a => a.status === 'working').length,
    };
  }
}

// ==================== Orchestrator Control ====================

export class OrchestratorControl {
  private orchestrator: Orchestrator;
  private wasRunning = false;

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
  }

  // Safe: stop orchestrator with rollback (restart)
  async enableBackpressure(safetyChecks?: SafetyCheck[]): Promise<MutationResult> {
    const before = { queueSize: 0, isRunning: 1 };

    if (safetyChecks) {
      for (const check of safetyChecks) {
        if (!check.check(before)) {
          return { success: false, action: 'enableBackpressure', before, after: before, error: `Safety check failed: ${check.message}` };
        }
      }
    }

    this.wasRunning = true;
    this.orchestrator.stop();

    const after = { queueSize: 0, isRunning: 0 };

    const rollback = async () => {
      if (this.wasRunning) {
        this.orchestrator.start();
      }
    };

    return {
      success: true,
      action: 'enableBackpressure',
      before,
      after,
      rollback,
    };
  }
}

// ==================== Control Layer (Main) ====================

export class ControlLayer {
  public taskManager: TaskManagerControl;
  public agentPool: AgentPoolControl;
  public orchestrator: OrchestratorControl;
  private eventBus: EventBus;
  private rollbackLog: { action: string; timestamp: number; rollback: () => Promise<void> }[] = [];

  constructor(
    taskManager: TaskManager,
    agentPool: AgentPool,
    orchestrator: Orchestrator,
    eventBus: EventBus
  ) {
    this.taskManager = new TaskManagerControl(taskManager);
    this.agentPool = new AgentPoolControl(agentPool);
    this.orchestrator = new OrchestratorControl(orchestrator);
    this.eventBus = eventBus;
  }

  // Execute a mutation with logging and rollback tracking
  async execute(
    name: string,
    mutation: () => Promise<MutationResult>
  ): Promise<MutationResult> {
    const result = await mutation();

    // Log AFTER state change
    await this.eventBus.emit('control:mutation_executed', {
      action: name,
      success: result.success,
      before: result.before,
      after: result.after,
    }, 'control-layer').catch(() => {});

    // Store rollback if available
    if (result.rollback) {
      this.rollbackLog.push({
        action: name,
        timestamp: Date.now(),
        rollback: result.rollback,
      });
    }

    return result;
  }

  // Rollback last action
  async rollbackLast(): Promise<boolean> {
    const last = this.rollbackLog.pop();
    if (!last) return false;

    try {
      await last.rollback();
      await this.eventBus.emit('control:rollback_executed', {
        action: last.action,
        timestamp: last.timestamp,
      }, 'control-layer').catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // Get all metrics
  getAllMetrics(): Record<string, number> {
    return {
      ...this.taskManager.getMetrics(),
      ...this.agentPool.getMetrics(),
    };
  }
}