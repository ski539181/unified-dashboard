// Agent Store — SQLite read model for agents
import { DatabaseManager } from './database';
import { Agent, AgentStatus } from '../modules/agent/agent-pool';

interface AgentRow {
  id: string;
  name: string;
  capabilities: string;
  status: string;
  current_task_id: string | null;
  health_score: number;
  last_heartbeat: number;
  total_completed: number;
  total_failed: number;
  created_at: number;
}

export class AgentStore {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  save(agent: Agent): void {
    this.db.getDb().prepare(`
      INSERT INTO agents (id, name, capabilities, status, current_task_id,
        health_score, last_heartbeat, total_completed, total_failed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, capabilities=excluded.capabilities, status=excluded.status,
        current_task_id=excluded.current_task_id, health_score=excluded.health_score,
        last_heartbeat=excluded.last_heartbeat, total_completed=excluded.total_completed,
        total_failed=excluded.total_failed
    `).run(
      agent.id, agent.name, JSON.stringify(agent.capabilities), agent.status,
      agent.currentTaskId || null, agent.healthScore, agent.lastHeartbeat,
      agent.totalCompleted, agent.totalFailed, agent.createdAt
    );
  }

  get(agentId: string): Agent | undefined {
    const row = this.db.getDb().prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRow | undefined;
    return row ? this.rowToAgent(row) : undefined;
  }

  getAll(): Agent[] {
    const rows = this.db.getDb().prepare('SELECT * FROM agents').all() as AgentRow[];
    return rows.map(r => this.rowToAgent(r));
  }

  delete(agentId: string): void {
    this.db.getDb().prepare('DELETE FROM agents WHERE id = ?').run(agentId);
  }

  private rowToAgent(row: AgentRow): Agent {
    return {
      id: row.id,
      name: row.name,
      capabilities: JSON.parse(row.capabilities),
      status: row.status as AgentStatus,
      currentTaskId: row.current_task_id || undefined,
      healthScore: row.health_score,
      lastHeartbeat: row.last_heartbeat,
      totalCompleted: row.total_completed,
      totalFailed: row.total_failed,
      createdAt: row.created_at,
    };
  }
}