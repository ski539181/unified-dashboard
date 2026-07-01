// Orchestrator — Skill-based routing + task execution
import { EventBus } from '../../event/bus';
import { TaskManager, Task } from '../task/task-manager';
import { AgentPool } from '../../modules/agent/agent-pool';

// Orchestrator
export class Orchestrator {
  private taskManager: TaskManager;
  private agentPool: AgentPool;
  private eventBus: EventBus;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(eventBus: EventBus, taskManager: TaskManager, agentPool: AgentPool) {
    this.eventBus = eventBus;
    this.taskManager = taskManager;
    this.agentPool = agentPool;
  }

  // Start orchestrator loop (1 Hz)
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
    console.log('Orchestrator started');
  }

  // Stop orchestrator
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Orchestrator stopped');
  }

  // Main tick (called every second)
  private async tick(): Promise<void> {
    try {
      // 1. Check queue for pending tasks
      const queuedTask = this.taskManager.dequeueTask();
      if (queuedTask) {
        await this.routeTask(queuedTask.task);
      }

      // 2. Check running tasks for timeout
      await this.checkTimeouts();

      // 3. Check agent health
      await this.checkAgentHealth();

    } catch (error) {
      console.error('Orchestrator tick error:', error);
    }
  }

  // Route task to appropriate agent
  private async routeTask(task: Task): Promise<void> {
    // Find available agents with required skills
    const availableAgents = this.agentPool.getAvailableAgents(task.requiredSkills);

    if (availableAgents.length === 0) {
      console.log(`No available agents for task ${task.id}, re-queuing`);
      // Re-enqueue with lower priority
      this.taskManager.createTask(
        task.title,
        task.description,
        task.priority + 1,
        task.requiredSkills,
        'orchestrator'
      );
      return;
    }

    // Select agent (simple: first available)
    // TODO: Implement smarter routing (priority + skill match)
    const selectedAgent = availableAgents[0];

    // Assign task
    await this.taskManager.assignTask(task.id, selectedAgent.id);
    await this.agentPool.assignTask(selectedAgent.id, task.id);

    // Execute task
    await this.executeTask(task, selectedAgent.id);
  }

  // Execute task with agent
  private async executeTask(task: Task, agentId: string): Promise<void> {
    try {
      // Start task
      await this.taskManager.startTask(task.id);

      // Prepare context (from memory service)
      const context = await this.prepareContext(task);

      // Execute
      const result = await this.agentPool.executeTask(agentId, task, context);

      // Complete task
      await this.taskManager.completeTask(task.id, result);

      // Write to memory
      await this.writeToMemory(task, result);

      console.log(`Task ${task.id} completed by agent ${agentId}`);

    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      await this.taskManager.failTask(task.id, (error as Error).message);
    }
  }

  // Prepare context for agent
  private async prepareContext(task: Task): Promise<Record<string, unknown>> {
    // TODO: Load from memory service
    return {
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      timestamp: Date.now(),
    };
  }

  // Write result to memory
  private async writeToMemory(task: Task, result: Record<string, unknown>): Promise<void> {
    // TODO: Write to memory service (Memory Writer)
    await this.eventBus.emit('memory:updated', {
      taskId: task.id,
      result,
      tier: 'working',
    }, 'orchestrator');
  }

  // Check for timed out tasks
  private async checkTimeouts(): Promise<void> {
    const tasks = this.taskManager.getAllTasks();
    const now = Date.now();

    for (const task of tasks) {
      if (task.status === 'running' && task.startedAt) {
        const elapsed = now - task.startedAt;
        if (elapsed > task.timeoutMs) {
          console.log(`Task ${task.id} timed out after ${elapsed}ms`);
          await this.taskManager.failTask(task.id, 'Timeout');
          
          // Reset agent
          if (task.assignedAgentId) {
            const agent = this.agentPool.getAgent(task.assignedAgentId);
            if (agent && agent.status === 'working') {
              await this.agentPool.assignTask(task.assignedAgentId, ''); // Reset to idle
            }
          }
        }
      }
    }
  }

  // Check agent health
  private async checkAgentHealth(): Promise<void> {
    const agents = this.agentPool.getAllAgents();
    const now = Date.now();

    for (const agent of agents) {
      // Check heartbeat (if agent is working, should heartbeat every 30s)
      if (agent.status === 'working') {
        const elapsed = now - agent.lastHeartbeat;
        if (elapsed > 30000) {
          console.log(`Agent ${agent.id} heartbeat timeout`);
          // Agent might be stuck
          await this.eventBus.emit('agent:heartbeat_timeout', {
            agentId: agent.id,
            elapsed,
          }, 'orchestrator');
        }
      }
    }
  }

  // Create task (public API)
  async createTask(
    title: string,
    description: string | undefined,
    priority: number,
    requiredSkills: string[]
  ): Promise<Task> {
    return this.taskManager.createTask(
      title,
      description,
      priority,
      requiredSkills,
      'user'
    );
  }

  // Get stats
  getStats(): {
    queueSize: number;
    agents: ReturnType<AgentPool['getStats']>;
  } {
    return {
      queueSize: this.taskManager.getQueueSize(),
      agents: this.agentPool.getStats(),
    };
  }
}
