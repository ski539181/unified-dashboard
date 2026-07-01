// Skill Store — SQLite read model for skills
import { DatabaseManager } from './database';
import { SkillRecord } from '../modules/skill/skill-evaluator';

interface SkillRow {
  id: string;
  name: string;
  agent_id: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
  total_duration_ms: number;
  health_score: number;
  last_used_at: number;
  created_at: number;
}

export class SkillStore {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  save(record: SkillRecord): void {
    this.db.getDb().prepare(`
      INSERT INTO skills (id, name, agent_id, usage_count, success_count, failure_count,
        total_duration_ms, health_score, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name, agent_id) DO UPDATE SET
        usage_count=excluded.usage_count, success_count=excluded.success_count,
        failure_count=excluded.failure_count, total_duration_ms=excluded.total_duration_ms,
        health_score=excluded.health_score, last_used_at=excluded.last_used_at
    `).run(
      record.id, record.name, record.agentId, record.usageCount, record.successCount,
      record.failureCount, record.totalDurationMs, record.healthScore,
      record.lastUsedAt, record.createdAt
    );
  }

  get(agentId: string, skillName: string): SkillRecord | undefined {
    const row = this.db.getDb().prepare(
      'SELECT * FROM skills WHERE agent_id = ? AND name = ?'
    ).get(agentId, skillName) as SkillRow | undefined;
    return row ? this.rowToRecord(row) : undefined;
  }

  getByAgent(agentId: string): SkillRecord[] {
    const rows = this.db.getDb().prepare(
      'SELECT * FROM skills WHERE agent_id = ? ORDER BY health_score DESC'
    ).all(agentId) as SkillRow[];
    return rows.map(r => this.rowToRecord(r));
  }

  getAll(): SkillRecord[] {
    const rows = this.db.getDb().prepare('SELECT * FROM skills ORDER BY health_score DESC').all() as SkillRow[];
    return rows.map(r => this.rowToRecord(r));
  }

  delete(agentId: string, skillName: string): void {
    this.db.getDb().prepare('DELETE FROM skills WHERE agent_id = ? AND name = ?').run(agentId, skillName);
  }

  private rowToRecord(row: SkillRow): SkillRecord {
    return {
      id: row.id,
      name: row.name,
      agentId: row.agent_id,
      usageCount: row.usage_count,
      successCount: row.success_count,
      failureCount: row.failure_count,
      totalDurationMs: row.total_duration_ms,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      healthScore: row.health_score,
      trend: 'stable',
    };
  }
}