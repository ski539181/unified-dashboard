// Memory Store — SQLite read model for memories
import { DatabaseManager } from './database';
import { MemoryEntry, MemoryTier } from '../modules/memory/memory-manager';

interface MemoryRow {
  id: string;
  content: string;
  metadata: string;
  tier: string;
  score: number;
  access_count: number;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  tags: string;
}

export class MemoryStore {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  save(entry: MemoryEntry): void {
    this.db.getDb().prepare(`
      INSERT INTO memories (id, content, metadata, tier, score, access_count,
        created_at, updated_at, expires_at, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content=excluded.content, metadata=excluded.metadata, tier=excluded.tier,
        score=excluded.score, access_count=excluded.access_count,
        updated_at=excluded.updated_at, expires_at=excluded.expires_at, tags=excluded.tags
    `).run(
      entry.id, entry.content, JSON.stringify(entry.metadata), entry.tier,
      entry.score, entry.accessCount, entry.createdAt, entry.updatedAt,
      entry.expiresAt || null, JSON.stringify(entry.tags)
    );
  }

  get(id: string): MemoryEntry | undefined {
    const row = this.db.getDb().prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow | undefined;
    return row ? this.rowToEntry(row) : undefined;
  }

  getAll(): MemoryEntry[] {
    const rows = this.db.getDb().prepare('SELECT * FROM memories ORDER BY created_at DESC').all() as MemoryRow[];
    return rows.map(r => this.rowToEntry(r));
  }

  getByTier(tier: MemoryTier): MemoryEntry[] {
    const rows = this.db.getDb().prepare('SELECT * FROM memories WHERE tier = ?').all(tier) as MemoryRow[];
    return rows.map(r => this.rowToEntry(r));
  }

  search(query: string): MemoryEntry[] {
    const rows = this.db.getDb().prepare(
      'SELECT * FROM memories WHERE content LIKE ? OR tags LIKE ? ORDER BY score DESC'
    ).all(`%${query}%`, `%${query}%`) as MemoryRow[];
    return rows.map(r => this.rowToEntry(r));
  }

  delete(id: string): void {
    this.db.getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  private rowToEntry(row: MemoryRow): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      tier: row.tier as MemoryTier,
      score: row.score,
      accessCount: row.access_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at || undefined,
      tags: JSON.parse(row.tags),
    };
  }
}