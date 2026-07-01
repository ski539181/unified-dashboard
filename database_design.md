# Unified Dashboard — Database Design

**Version**: 1.0.0
**Date**: 2026-07-01
**Status**: 🟡 Draft — รอ Review

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Pluggable DB** | Repository Pattern — เปลี่ยน SQLite → PostgreSQL ได้ |
| **Event Sourcing** | Event Store เป็น append-only log |
| **CQRS** | Separate read/write models สำหรับ performance |
| **Normalization** | 3NF สำหรับ write, Denormalize สำหรับ read |
| **Indexing** | ทุก foreign key + frequently queried columns |

---

## 2. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AUTH SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│  users ──────────────► user_sessions                                │
│     │                        │                                      │
│     └────────────────────────┴────────────► user_roles              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          TASK SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│  tasks ──────────────► task_dependencies                            │
│     │                        │                                      │
│     ├────────────────────────┴────────────► task_logs               │
│     │                                                         │
│     └─────────────────────────────────────► task_assignments        │
│                                                             │
│  task_assignments ─────────────────────────────────────► agents     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          AGENT SYSTEM                               │
├─────────────────────────────────────────────────────────────────────┤
│  agents ──────────────► agent_capabilities                          │
│     │                        │                                      │
│     └────────────────────────┴────────────► agent_logs              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          MEMORY SYSTEM                              │
├─────────────────────────────────────────────────────────────────────┤
│  memory_working ──────► memory_longterm ──────► memory_vector       │
│       │                      │                      │               │
│       └──────────────────────┴──────────────────────┴──► memory_tags│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          SKILL SYSTEM                               │
├─────────────────────────────────────────────────────────────────────┤
│  skills ──────────────► skill_usage                                 │
│     │                        │                                      │
│     └────────────────────────┴────────────► skill_health            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          LEARNING SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│  lessons ──────────────► lesson_tags                                │
│  patterns ──────────────► pattern_examples                          │
│  metrics ──────────────► metric_tags                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          EVENT SYSTEM                               │
├─────────────────────────────────────────────────────────────────────┤
│  event_store (append-only) ──────────────────────────────────────►  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          LOGGING SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│  logs ──────────────► log_tags                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          NOTIFICATION SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│  notifications ──────► notification_actions                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Schema Definitions

### 3.1 Auth System

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,            -- bcrypt
  display_name TEXT,
  role TEXT DEFAULT 'viewer',             -- admin/operator/viewer
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Sessions
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,        -- JWT hash
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
```

---

### 3.2 Task System

```sql
-- Tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,                    -- UUID
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'created',          -- created/queued/assigned/running/completed/failed/dead_letter
  priority INTEGER DEFAULT 5,             -- 1 (highest) to 10 (lowest)
  required_skills TEXT,                   -- JSON array of skill names
  assigned_agent_id TEXT,                 -- References agents(id)
  created_by TEXT REFERENCES users(id),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 300000,      -- 5 minutes
  result TEXT,                            -- JSON result data
  error_message TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_agent ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_created ON tasks(created_at);

-- Task Dependencies
CREATE TABLE task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'finish_to_start', -- finish_to_start/start_to_start
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, depends_on_id)
);

CREATE INDEX idx_task_deps_task ON task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends ON task_dependencies(depends_on_id);

-- Task Assignments (history)
CREATE TABLE task_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  status TEXT DEFAULT 'active'            -- active/completed/failed/reassigned
);

CREATE INDEX idx_task_assign_task ON task_assignments(task_id);
CREATE INDEX idx_task_assign_agent ON task_assignments(agent_id);

-- Task Logs
CREATE TABLE task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  level TEXT NOT NULL,                    -- debug/info/warn/error
  message TEXT NOT NULL,
  metadata TEXT,                          -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_logs_task ON task_logs(task_id);
CREATE INDEX idx_task_logs_level ON task_logs(level);
```

---

### 3.3 Agent System

```sql
-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'offline',          -- offline/register/idle/working/paused/completed/error
  capabilities TEXT,                      -- JSON array of skill names
  current_task_id TEXT,                   -- References tasks(id)
  health_score INTEGER DEFAULT 100,       -- 0-100
  last_heartbeat DATETIME,
  total_tasks_completed INTEGER DEFAULT 0,
  total_tasks_failed INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_health ON agents(health_score);

-- Agent Capabilities
CREATE TABLE agent_capabilities (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency INTEGER DEFAULT 50,        -- 0-100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, skill_name)
);

CREATE INDEX idx_agent_cap_agent ON agent_capabilities(agent_id);
CREATE INDEX idx_agent_cap_skill ON agent_capabilities(skill_name);

-- Agent Logs
CREATE TABLE agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,                          -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_id);
```

---

### 3.4 Event System (Append-Only)

```sql
-- Event Store (Append-only)
CREATE TABLE event_store (
  id TEXT PRIMARY KEY,                    -- UUID
  type TEXT NOT NULL,                     -- "task:created", "agent:status_changed"
  version INTEGER NOT NULL DEFAULT 1,     -- Schema version
  payload TEXT NOT NULL,                  -- JSON serialized event data
  source TEXT NOT NULL,                   -- "orchestrator", "agent-1", "system"
  correlation_id TEXT,                    -- For tracing
  sequence_number INTEGER NOT NULL,       -- Auto-increment per type
  state TEXT DEFAULT 'created',           -- created/validated/published/processed/failed
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE INDEX idx_event_type ON event_store(type);
CREATE INDEX idx_event_timestamp ON event_store(created_at);
CREATE INDEX idx_event_correlation ON event_store(correlation_id);
CREATE INDEX idx_event_state ON event_store(state);
CREATE INDEX idx_event_sequence ON event_store(sequence_number);

-- Sequence counter (for ordering)
CREATE TABLE event_sequences (
  type TEXT PRIMARY KEY,
  current_value INTEGER DEFAULT 0
);
```

---

### 3.5 Memory System (3-Tier)

```sql
-- Working Memory (L1) — In-memory, but schema for reference
CREATE TABLE memory_working (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'context',            -- context/task/result/error
  priority INTEGER DEFAULT 5,             -- 1 (highest) to 10 (lowest)
  access_count INTEGER DEFAULT 0,
  last_accessed DATETIME,
  expires_at DATETIME NOT NULL,           -- TTL: 5 minutes
  metadata TEXT,                          -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memory_working_expires ON memory_working(expires_at);
CREATE INDEX idx_memory_working_priority ON memory_working(priority);

-- Long-term Memory (L2)
CREATE TABLE memory_longterm (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'knowledge',          -- knowledge/experience/rule/pattern
  tier TEXT DEFAULT 'longterm',
  source TEXT,                            -- Where this memory came from
  tags TEXT,                              -- JSON array
  access_count INTEGER DEFAULT 0,
  relevance_score REAL DEFAULT 0.5,       -- 0.0-1.0
  last_accessed DATETIME,
  compressed BOOLEAN DEFAULT FALSE,
  original_id TEXT,                       -- If compressed, reference to original
  metadata TEXT,                          -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memory_lt_type ON memory_longterm(type);
CREATE INDEX idx_memory_lt_tier ON memory_longterm(tier);
CREATE INDEX idx_memory_lt_relevance ON memory_longterm(relevance_score);
CREATE INDEX idx_memory_lt_accessed ON memory_longterm(last_accessed);

-- Vector Memory (L3)
CREATE TABLE memory_vector (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memory_longterm(id) ON DELETE CASCADE,
  embedding BLOB NOT NULL,               -- Vector embedding (float32 array)
  dimension INTEGER NOT NULL,            -- Embedding dimension
  model TEXT NOT NULL,                   -- Embedding model used
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memory_vec_memory ON memory_vector(memory_id);

-- Memory Tags
CREATE TABLE memory_tags (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,             -- 'working', 'longterm', 'vector'
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(memory_id, memory_type, tag)
);

CREATE INDEX idx_memory_tags_memory ON memory_tags(memory_id, memory_type);
CREATE INDEX idx_memory_tags_tag ON memory_tags(tag);
```

---

### 3.6 Skill System

```sql
-- Skills
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,                          -- coding/research/design/devops/etc
  version TEXT DEFAULT '1.0.0',
  health_score INTEGER DEFAULT 100,       -- 0-100
  is_active BOOLEAN DEFAULT TRUE,
  file_path TEXT,                         -- Path to skill file
  metadata TEXT,                          -- JSON (tags, dependencies, etc)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_health ON skills(health_score);
CREATE INDEX idx_skills_active ON skills(is_active);

-- Skill Usage
CREATE TABLE skill_usage (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id),
  agent_id TEXT REFERENCES agents(id),
  duration_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skill_usage_skill ON skill_usage(skill_id);
CREATE INDEX idx_skill_usage_task ON skill_usage(task_id);
CREATE INDEX idx_skill_usage_created ON skill_usage(created_at);

-- Skill Health History
CREATE TABLE skill_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL,
  reason TEXT,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skill_health_skill ON skill_health(skill_id);
CREATE INDEX idx_skill_health_time ON skill_health(measured_at);
```

---

### 3.7 Learning System

```sql
-- Lessons
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,                          -- error/pattern/optimization/insight
  source TEXT,                            -- Where this lesson came from
  confidence REAL DEFAULT 0.5,            -- 0.0-1.0
  applied_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,          -- 0.0-1.0
  metadata TEXT,                          -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lessons_category ON lessons(category);
CREATE INDEX idx_lessons_confidence ON lessons(confidence);

-- Lesson Tags
CREATE TABLE lesson_tags (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lesson_id, tag)
);

CREATE INDEX idx_lesson_tags_lesson ON lesson_tags(lesson_id);
CREATE INDEX idx_lesson_tags_tag ON lesson_tags(tag);

-- Patterns
CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  pattern_type TEXT,                      -- recurring/anti-pattern/best-practice
  frequency INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0.5,
  examples TEXT,                          -- JSON array of example cases
  metadata TEXT,                          -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patterns_type ON patterns(pattern_type);
CREATE INDEX idx_patterns_frequency ON patterns(frequency);

-- Pattern Examples
CREATE TABLE pattern_examples (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  example_text TEXT NOT NULL,
  context TEXT,                           -- JSON context
  outcome TEXT,                           -- success/failure
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pattern_ex_pattern ON pattern_examples(pattern_id);

-- Learning Metrics
CREATE TABLE learning_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  dimension TEXT,                         -- accuracy/speed/quality/etc
  tags TEXT,                              -- JSON
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_metrics_name ON learning_metrics(metric_name);
CREATE INDEX idx_learning_metrics_time ON learning_metrics(measured_at);
CREATE INDEX idx_learning_metrics_dim ON learning_metrics(dimension);
```

---

### 3.8 Logging System

```sql
-- Logs
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,                    -- debug/info/warn/error/fatal
  module TEXT,                            -- Which module produced this log
  message TEXT NOT NULL,
  metadata TEXT,                          -- JSON (stack trace, context, etc)
  source TEXT,                            -- "api", "agent", "system", "user"
  correlation_id TEXT,                    -- For tracing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_module ON logs(module);
CREATE INDEX idx_logs_time ON logs(created_at);
CREATE INDEX idx_logs_correlation ON logs(correlation_id);

-- Log Tags
CREATE TABLE log_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id INTEGER NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(log_id, tag)
);

CREATE INDEX idx_log_tags_log ON log_tags(log_id);
CREATE INDEX idx_log_tags_tag ON log_tags(tag);
```

---

### 3.9 Notification System

```sql
-- Notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',               -- info/warning/error/success
  priority TEXT DEFAULT 'normal',         -- low/normal/high/urgent
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,                        -- URL to navigate to
  metadata TEXT,                          -- JSON
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_time ON notifications(created_at);

-- Notification Actions
CREATE TABLE notification_actions (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  action_type TEXT NOT NULL,              -- link/api/function
  action_payload TEXT,                    -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notif_actions_notif ON notification_actions(notification_id);
```

---

### 3.10 System Tables

```sql
-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'general',        -- general/security/performance/ui
  is_secret BOOLEAN DEFAULT FALSE,
  description TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_category ON settings(category);

-- Metrics (for dashboard charts)
CREATE TABLE metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,                              -- ms/count/percent/bytes
  tags TEXT,                              -- JSON
  source TEXT,                            -- "agent", "task", "system"
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_time ON metrics(measured_at);
CREATE INDEX idx_metrics_source ON metrics(source);
```

---

## 4. Read/Write Model Separation

### 4.1 Write Model (Normalized)

ใช้สำหรับ: สร้าง/อัพเดท/ลบข้อมูล

```
tasks → task_assignments → agents
memory_working → memory_longterm → memory_vector
event_store (append-only)
```

### 4.2 Read Model (Denormalized)

ใช้สำหรับ: query ข้อมูลแสดงผล

```sql
-- Read-optimized views
CREATE VIEW task_summary AS
SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  a.name AS agent_name,
  t.created_at,
  t.completed_at
FROM tasks t
LEFT JOIN agents a ON t.assigned_agent_id = a.id;

CREATE VIEW agent_status AS
SELECT 
  a.id,
  a.name,
  a.status,
  a.health_score,
  COUNT(CASE WHEN t.status = 'running' THEN 1 END) AS active_tasks,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS completed_tasks
FROM agents a
LEFT JOIN tasks t ON a.id = t.assigned_agent_id
GROUP BY a.id;

CREATE VIEW memory_search AS
SELECT 
  m.id,
  m.content,
  m.type,
  m.tier,
  m.relevance_score,
  GROUP_CONCAT(t.tag) AS tags
FROM memory_longterm m
LEFT JOIN memory_tags t ON m.id = t.memory_id AND t.memory_type = 'longterm'
GROUP BY m.id;
```

---

## 5. Indexing Strategy

### 5.1 Index Types

| Type | Usage | Example |
|------|-------|---------|
| **B-tree** | Range queries, sorting | `created_at`, `priority` |
| **Hash** | Equality lookups | `id`, `token_hash` |
| **Composite** | Multi-column queries | `(status, priority)` |
| **Partial** | Filtered queries | `WHERE read = FALSE` |

### 5.2 Index Rules

| Rule | Description |
|------|-------------|
| **FK indexes** | ทุก foreign key ต้องมี index |
| **Query indexes** | ทุก WHERE clause ที่ใช้บ่อย |
| **Sort indexes** | ทุก ORDER BY ที่ใช้บ่อย |
| **No over-indexing** | ไม่เกิน 5 indexes ต่อ table |

---

## 6. Migration Strategy

### 6.1 SQLite → PostgreSQL

```
Phase 1: SQLite (ปัจจุบัน)
    │
    ├──► ใช้ Drizzle ORM
    ├──► Repository Pattern
    └──► ไม่ใช้ SQLite-specific features
            │
            ▼
Phase 2: PostgreSQL (เมื่อ scale)
    │
    ├──► เปลี่ยน connection string
    ├──► รัน migration scripts
    └──► ไม่ต้องแก้ application code
```

### 6.2 Migration Files

```
migrations/
├── 001_initial_schema.sql
├── 002_add_event_store.sql
├── 003_add_memory_tables.sql
└── 004_add_indexes.sql
```

---

## 7. Schema Summary

| System | Tables | Indexes | Notes |
|--------|--------|---------|-------|
| **Auth** | users, sessions | 6 | JWT + RBAC |
| **Task** | tasks, dependencies, assignments, logs | 10 | Kanban + history |
| **Agent** | agents, capabilities, logs | 6 | Stateless, health tracking |
| **Event** | event_store, sequences | 5 | Append-only, ordered |
| **Memory** | working, longterm, vector, tags | 10 | 3-tier architecture |
| **Skill** | skills, usage, health | 6 | Health tracking |
| **Learning** | lessons, tags, patterns, metrics | 9 | AI learning |
| **Logs** | logs, tags | 5 | Structured logging |
| **Notification** | notifications, actions | 4 | Priority + actions |
| **System** | settings, metrics | 4 | Config + monitoring |
| **Total** | **29 tables** | **52 indexes** | |

---

## 8. Assumptions

| Assumption | Status | Proof Method |
|------------|--------|--------------|
| SQLite พอสำหรับ MVP | 🟡 Hypothesis | Load test |
| 29 tables ไม่ซับซ้อนเกินไป | 🟡 Hypothesis | Review |
| Views ช่วย performance | 🟡 Hypothesis | Benchmark |
| Repository Pattern ทำงานได้ | 🟡 Hypothesis | Integration test |

---

**End of Database Design Document**
**Status**: 🟡 Draft — รอ Review จากวุ่น
**Next**: Milestone 3 (Backend Foundation)
