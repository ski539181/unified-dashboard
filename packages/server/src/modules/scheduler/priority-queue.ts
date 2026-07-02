// Priority Queue — Agent OS v6.1
import { ScheduledTask, Priority } from './types';

const PRIORITY_ORDER: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export class PriorityQueue {
  private queue: ScheduledTask[] = [];

  /**
   * Add task to queue (sorted by priority, then arrival time)
   */
  enqueue(task: ScheduledTask): void {
    this.queue.push(task);
    this.sort();
  }

  /**
   * Remove and return highest priority task
   */
  dequeue(): ScheduledTask | undefined {
    return this.queue.shift();
  }

  /**
   * Peek at highest priority task
   */
  peek(): ScheduledTask | undefined {
    return this.queue[0];
  }

  /**
   * Remove task by ID
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get task by ID
   */
  get(taskId: string): ScheduledTask | undefined {
    return this.queue.find((t) => t.id === taskId);
  }

  /**
   * Get all tasks for an agent
   */
  getByAgent(agentId: string): ScheduledTask[] {
    return this.queue.filter((t) => t.agentId === agentId);
  }

  /**
   * Check if task is in queue
   */
  has(taskId: string): boolean {
    return this.queue.some((t) => t.id === taskId);
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get all tasks
   */
  getAll(): ScheduledTask[] {
    return [...this.queue];
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Sort queue by priority (P0 first), then by creation time (FIFO)
   */
  private sort(): void {
    this.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Age priorities (increase priority for waiting tasks)
   */
  agePriorities(agingThreshold: number = 10000): void {
    const now = Date.now();
    for (const task of this.queue) {
      const waitTime = now - task.createdAt;
      if (waitTime > agingThreshold) {
        // Age: increase priority
        const currentIndex = PRIORITY_ORDER[task.priority];
        if (currentIndex > 0) {
          const newPriority = (Object.keys(PRIORITY_ORDER) as Priority[])[currentIndex - 1];
          task.priority = newPriority;
        }
      }
    }
    this.sort();
  }
}
