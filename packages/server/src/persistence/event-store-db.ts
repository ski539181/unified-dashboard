// EventStore SQLite Adapter — Source of truth
// Replaces in-memory EventStore with SQLite persistence
import { DatabaseManager } from './database';
import { BaseEvent } from '../event/bus';

interface EventRow {
  id: string;
  type: string;
  version: number;
  timestamp: number;
  source: string;
  correlation_id: string | null;
  payload: string;
  sequence: number;
}

export class EventStoreDB {
  private db: DatabaseManager;
  private sequenceCounter = 0;

  constructor(db: DatabaseManager) {
    this.db = db;
    const row = this.db.getDb().prepare('SELECT MAX(sequence) as max_seq FROM events').get() as { max_seq: number | null };
    this.sequenceCounter = row.max_seq || 0;
  }

  async append(event: BaseEvent): Promise<void> {
    this.sequenceCounter++;
    this.db.getDb().prepare(`
      INSERT INTO events (id, type, version, timestamp, source, correlation_id, payload, sequence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.type, event.version, event.timestamp, event.source,
      event.correlationId || null, JSON.stringify(event.payload), this.sequenceCounter
    );
  }

  async query(filter: { type?: string; from?: number; to?: number; correlationId?: string }): Promise<BaseEvent[]> {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (filter.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    if (filter.from) {
      sql += ' AND timestamp >= ?';
      params.push(filter.from);
    }
    if (filter.to) {
      sql += ' AND timestamp <= ?';
      params.push(filter.to);
    }
    if (filter.correlationId) {
      sql += ' AND correlation_id = ?';
      params.push(filter.correlationId);
    }

    sql += ' ORDER BY sequence ASC';

    const rows = this.db.getDb().prepare(sql).all(...params) as EventRow[];
    return rows.map(r => this.rowToEvent(r));
  }

  async getSequence(): Promise<number> {
    return this.sequenceCounter;
  }

  async count(): Promise<number> {
    const row = this.db.getDb().prepare('SELECT COUNT(*) as cnt FROM events').get() as { cnt: number };
    return row.cnt;
  }

  private rowToEvent(row: EventRow): BaseEvent {
    return {
      id: row.id,
      type: row.type,
      version: row.version,
      timestamp: row.timestamp,
      source: row.source,
      correlationId: row.correlation_id || undefined,
      payload: JSON.parse(row.payload),
    };
  }
}