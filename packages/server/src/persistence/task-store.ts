// Task Store — SQLite read model for tasks
import { DatabaseManager } from './database';
import { Task, TaskStatus } from '../modules/task/task-manager';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  required_skills: string;
  assigned_agent_id: string | null;
  retry_count: number;
  max_retries: number;
  timeout_ms: number;
  result: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export class TaskStore {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  save(task: Task): void {
    this.db.getDb().prepare(`
      INSERT INTO tasks (id, title, description, status, priority, required_skills,
        assigned_agent_id, retry_count, max_retries, timeout_ms, result, error_message,
        created_at, updated_at, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, description=excluded.description, status=excluded.status,
        priority=excluded.priority, required_skills=excluded.required_skills,
        assigned_agent_id=excluded.assigned_agent_id, retry_count=excluded.retry_count,
        max_retries=excluded.max_retries, timeout_ms=excluded.timeout_ms,
        result=excluded.result, error_message=excluded.error_message,
        updated_at=excluded.updated_at, started_at=excluded.started_at,
        completed_at=excluded.completed_at
    `).run(
      task.id, task.title, task.description || null, task.status, task.priority,
      JSON.stringify(task.requiredSkills), task.assignedAgentId || null,
      task.retryCount, task.maxRetries, task.timeoutMs,
      task.result ? JSON.stringify(task.result) : null,
      task.errorMessage || null,
      task.createdAt, task.updatedAt, task.startedAt || null, task.completedAt || null
    );
  }

  get(taskId: string): Task | undefined {
    const row = this.db.getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    return row ? this.rowToTask(row) : undefined;
  }

  getAll(): Task[] {
    const rows = this.db.getDb().prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as TaskRow[];
    return rows.map(r => this.rowToTask(r));
  }

  getByStatus(status: TaskStatus): Task[] {
    const rows = this.db.getDb().prepare('SELECT * FROM tasks WHERE status = ?').all(status) as TaskRow[];
    return rows.map(r => this.rowToTask(r));
  }

  delete(taskId: string): void {
    this.db.getDb().prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  }

  private rowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      status: row.status as TaskStatus,
      priority: row.priority,
      requiredSkills: JSON.parse(row.required_skills),
      assignedAgentId: row.assigned_agent_id || undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      timeoutMs: row.timeout_ms,
      result: row.result ? JSON.parse(row.result) : undefined,
      errorMessage: row.error_message || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }
}