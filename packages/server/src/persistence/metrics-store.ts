// Metrics Store — SQLite read model for self-improvement metrics
import { DatabaseManager } from './database';

interface MetricsRow {
  id: string;
  timestamp: number;
  task_metrics: string;
  agent_metrics: string;
  memory_metrics: string;
  learning_metrics: string;
  overall_health: number;
}

export interface MetricsSnapshot {
  id: string;
  timestamp: number;
  taskMetrics: Record<string, unknown>;
  agentMetrics: Record<string, unknown>;
  memoryMetrics: Record<string, unknown>;
  learningMetrics: Record<string, unknown>;
  overallHealth: number;
}

export class MetricsStore {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  save(snapshot: MetricsSnapshot): void {
    this.db.getDb().prepare(`
      INSERT INTO metrics_history (id, timestamp, task_metrics, agent_metrics,
        memory_metrics, learning_metrics, overall_health)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.id, snapshot.timestamp,
      JSON.stringify(snapshot.taskMetrics), JSON.stringify(snapshot.agentMetrics),
      JSON.stringify(snapshot.memoryMetrics), JSON.stringify(snapshot.learningMetrics),
      snapshot.overallHealth
    );
  }

  getAll(): MetricsSnapshot[] {
    const rows = this.db.getDb().prepare(
      'SELECT * FROM metrics_history ORDER BY timestamp DESC LIMIT 100'
    ).all() as MetricsRow[];
    return rows.map(r => this.rowToSnapshot(r));
  }

  getLatest(): MetricsSnapshot | undefined {
    const row = this.db.getDb().prepare(
      'SELECT * FROM metrics_history ORDER BY timestamp DESC LIMIT 1'
    ).get() as MetricsRow | undefined;
    return row ? this.rowToSnapshot(row) : undefined;
  }

  private rowToSnapshot(row: MetricsRow): MetricsSnapshot {
    return {
      id: row.id,
      timestamp: row.timestamp,
      taskMetrics: JSON.parse(row.task_metrics),
      agentMetrics: JSON.parse(row.agent_metrics),
      memoryMetrics: JSON.parse(row.memory_metrics),
      learningMetrics: JSON.parse(row.learning_metrics),
      overallHealth: row.overall_health,
    };
  }
}