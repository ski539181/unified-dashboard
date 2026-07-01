// Healing Actions — Use ControlLayer for safe mutations
import { HealingAction, ActionResult } from './types';
import { ControlLayer } from './control-layer';

export class HealingActions {
  private control: ControlLayer;

  constructor(control: ControlLayer) {
    this.control = control;
  }

  getActions(): HealingAction[] {
    return [
      this.clearDeadLetters(),
      this.restartErrorAgents(),
      this.enableBackpressure(),
      this.reduceSendRate(),
    ];
  }

  getAction(name: string): HealingAction | undefined {
    return this.getActions().find(a => a.name === name);
  }

  // ==================== ACTION 1: Clear Dead Letters ====================
  clearDeadLetters(): HealingAction {
    return {
      name: 'clearDeadLetters',
      description: 'Remove dead_letter tasks from task map',
      cooldownMs: 60000,
      maxRetries: 3,
      execute: async (): Promise<ActionResult> => {
        const result = await this.control.execute('clearDeadLetters', () =>
          this.control.taskManager.clearDeadLetters([
            {
              name: 'minDeadLetters',
              check: (m) => m.deadLetterCount > 0,
              message: 'No dead letters to clear',
            },
          ])
        );

        return {
          success: result.success,
          actionName: 'clearDeadLetters',
          before: result.before,
          after: result.after,
          timestamp: Date.now(),
          error: result.error,
        };
      },
    };
  }

  // ==================== ACTION 2: Restart Error Agents ====================
  restartErrorAgents(): HealingAction {
    return {
      name: 'restartErrorAgents',
      description: 'Transition error agents to idle via state machine',
      cooldownMs: 30000,
      maxRetries: 2,
      execute: async (): Promise<ActionResult> => {
        const result = await this.control.execute('restartErrorAgents', () =>
          this.control.agentPool.restartErrorAgents([
            {
              name: 'hasErrorAgents',
              check: (m) => m.errorAgents > 0,
              message: 'No error agents to restart',
            },
          ])
        );

        return {
          success: result.success,
          actionName: 'restartErrorAgents',
          before: result.before,
          after: result.after,
          timestamp: Date.now(),
          error: result.error,
        };
      },
    };
  }

  // ==================== ACTION 3: Enable Backpressure ====================
  enableBackpressure(): HealingAction {
    return {
      name: 'enableBackpressure',
      description: 'Stop orchestrator to halt task processing',
      cooldownMs: 120000,
      maxRetries: 1,
      execute: async (): Promise<ActionResult> => {
        const result = await this.control.execute('enableBackpressure', () =>
          this.control.orchestrator.enableBackpressure([
            {
              name: 'orchestratorRunning',
              check: (m) => m.isRunning > 0,
              message: 'Orchestrator already stopped',
            },
          ])
        );

        return {
          success: result.success,
          actionName: 'enableBackpressure',
          before: result.before,
          after: result.after,
          timestamp: Date.now(),
          error: result.error,
        };
      },
    };
  }

  // ==================== ACTION 4: Reduce Send Rate ====================
  reduceSendRate(): HealingAction {
    return {
      name: 'reduceSendRate',
      description: 'Double timeout for all queued/assigned tasks',
      cooldownMs: 60000,
      maxRetries: 2,
      execute: async (): Promise<ActionResult> => {
        const result = await this.control.execute('reduceSendRate', () =>
          this.control.taskManager.reduceSendRate([
            {
              name: 'hasQueuedTasks',
              check: (m) => m.queueSize > 0,
              message: 'No queued tasks to adjust',
            },
          ])
        );

        return {
          success: result.success,
          actionName: 'reduceSendRate',
          before: result.before,
          after: result.after,
          timestamp: Date.now(),
          error: result.error,
        };
      },
    };
  }
}