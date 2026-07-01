// Task System — State machine + priority queue + retry logic
import { v4 as uuidv4 } from 'uuid';
import { EventBus, BaseEvent } from '../../event/bus';

// Task Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
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

export type TaskStatus = 
  | 'created'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead_letter';

// Task State Machine
export class TaskStateMachine {
  private transitions: Map<TaskStatus, TaskStatus[]> = new Map([
    ['created', ['queued']],
    ['queued', ['assigned', 'failed']],
    ['assigned', ['running', 'failed']],
    ['running', ['completed', 'failed']],
    ['completed', []],
    ['failed', ['queued', 'dead_letter']],
    ['dead_letter', []],
  ]);

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    const allowed = this.transitions.get(from) || [];
    return allowed.includes(to);
  }

  transition(task: Task, to: TaskStatus): Task {
    if (!this.canTransition(task.status, to)) {
      throw new Error(`Invalid transition: ${task.status} -> ${to}`);
    }

    const updated = { ...task, status: to, updatedAt: Date.now() };

    if (to === 'running') {
      updated.startedAt = Date.now();
    }
    if (to === 'completed' || to === 'failed' || to === 'dead_letter') {
      updated.completedAt = Date.now();
    }

    return updated;
  }
}

// Task Queue (Priority-based)
export class TaskQueue {
  private queue: { task: Task; priority: number }[] = [];

  enqueue(task: Task, priority: number): void {
    const insertIndex = this.queue.findIndex(q => q.priority > priority);
    if (insertIndex === -1) {
      this.queue.push({ task, priority });
    } else {
      this.queue.splice(insertIndex, 0, { task, priority });
    }
  }

  dequeue(): { task: Task; priority: number } | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  getTask(taskId: string): Task | undefined {
    return this.queue.find(q => q.task.id === taskId)?.task;
  }

  removeTask(taskId: string): boolean {
    const index = this.queue.findIndex(q => q.task.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Task Manager
export class TaskManager {
  private stateMachine = new TaskStateMachine();
  private queue = new TaskQueue();
  private tasks = new Map<string, Task>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // Create task
  async createTask(
    title: string,
    description: string | undefined,
    priority: number,
    requiredSkills: string[],
    createdBy: string
  ): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      title,
      description,
      status: 'created',
      priority,
      requiredSkills,
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 300000, // 5 minutes
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Transition to queued
    const queued = this.stateMachine.transition(task, 'queued');
    this.tasks.set(queued.id, queued);
    this.queue.enqueue(queued, queued.priority);

    // Emit event
    await this.eventBus.emit('task:created', {
      taskId: queued.id,
      title: queued.title,
      priority: queued.priority,
    }, createdBy);

    return queued;
  }

  // Get next task from queue
  dequeueTask(): { task: Task; priority: number } | undefined {
    return this.queue.dequeue();
  }

  // Assign task to agent
  async assignTask(taskId: string, agentId: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const assigned = this.stateMachine.transition(task, 'assigned');
    assigned.assignedAgentId = agentId;
    this.tasks.set(assigned.id, assigned);

    await this.eventBus.emit('task:assigned', {
      taskId: assigned.id,
      agentId,
    }, 'orchestrator');

    return assigned;
  }

  // Start task execution
  async startTask(taskId: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const running = this.stateMachine.transition(task, 'running');
    this.tasks.set(running.id, running);

    await this.eventBus.emit('task:started', {
      taskId: running.id,
      agentId: running.assignedAgentId,
    }, running.assignedAgentId || 'orchestrator');

    return running;
  }

  // Complete task
  async completeTask(taskId: string, result: Record<string, unknown>): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const completed = this.stateMachine.transition(task, 'completed');
    completed.result = result;
    this.tasks.set(completed.id, completed);

    await this.eventBus.emit('task:completed', {
      taskId: completed.id,
      result,
    }, completed.assignedAgentId || 'orchestrator');

    return completed;
  }

  // Fail task (with retry logic)
  async failTask(taskId: string, errorMessage: string): Promise<Task> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const failed = this.stateMachine.transition(task, 'failed');
    failed.errorMessage = errorMessage;
    failed.retryCount += 1;

    // Check if should retry
    if (failed.retryCount < failed.maxRetries) {
      // Requeue for retry
      failed.status = 'queued';
      failed.assignedAgentId = undefined;
      this.tasks.set(failed.id, failed);
      this.queue.enqueue(failed, failed.priority);

      await this.eventBus.emit('task:retry', {
        taskId: failed.id,
        retryCount: failed.retryCount,
        errorMessage,
      }, 'orchestrator');
    } else {
      // Dead letter
      failed.status = 'dead_letter';
      this.tasks.set(failed.id, failed);

      await this.eventBus.emit('task:dead_letter', {
        taskId: failed.id,
        errorMessage,
        retryCount: failed.retryCount,
      }, 'orchestrator');
    }

    return failed;
  }

  // Get task
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  // Get all tasks
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  // Get queue size
  getQueueSize(): number {
    return this.queue.size();
  }
}
