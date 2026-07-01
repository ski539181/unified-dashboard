// Database — Single SQLite instance shared across all stores
import Database = require('better-sqlite3');
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'hermes.db');

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || DB_PATH;
    
    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initSchema();
  }

  // Get raw connection for stores
  getDb(): Database.Database {
    return this.db;
  }

  // Run a function inside a transaction
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Initialize all tables
  private initSchema(): void {
    this.db.exec(`
      -- Events: append-only, source of truth
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        correlation_id TEXT,
        payload TEXT NOT NULL,
        sequence INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);

      -- Tasks: read model from events
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        required_skills TEXT NOT NULL DEFAULT '[]',
        assigned_agent_id TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        timeout_ms INTEGER NOT NULL DEFAULT 300000,
        result TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

      -- Agents: read model from events
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        capabilities TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'offline',
        current_task_id TEXT,
        health_score INTEGER NOT NULL DEFAULT 100,
        last_heartbeat INTEGER NOT NULL,
        total_completed INTEGER NOT NULL DEFAULT 0,
        total_failed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- Memories: read model from events
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        tier TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0.5,
        access_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER,
        tags TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);

      -- Skills: read model from events
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        total_duration_ms INTEGER NOT NULL DEFAULT 0,
        health_score REAL NOT NULL DEFAULT 50,
        last_used_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(name, agent_id)
      );
      CREATE INDEX IF NOT EXISTS idx_skills_agent ON skills(agent_id);

      -- Lessons: read model from events
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        pattern TEXT NOT NULL,
        category TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        evidence TEXT NOT NULL DEFAULT '[]',
        application_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_applied_at INTEGER
      );

      -- Metrics history: read model
      CREATE TABLE IF NOT EXISTS metrics_history (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        task_metrics TEXT NOT NULL DEFAULT '{}',
        agent_metrics TEXT NOT NULL DEFAULT '{}',
        memory_metrics TEXT NOT NULL DEFAULT '{}',
        learning_metrics TEXT NOT NULL DEFAULT '{}',
        overall_health REAL NOT NULL DEFAULT 0
      );
    `);
  }

  // Close connection
  close(): void {
    this.db.close();
  }
}