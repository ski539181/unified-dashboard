# Unified Dashboard — Architecture (Updated v3)

**Version**: 3.0.0
**Date**: 2026-07-01
**Status**: ✅ Approved — Ready for Milestone 2
**Author**: Hermes Agent (ดำ)

---

## 1. Vision

ระบบ Dashboard แบบ Single Page Application ที่รวมศูนย์ควบคุม AI Agent, Skills, Memory, Learning, Tasks, และ System Status ไว้ในที่เดียว รองรับ Real-time updates, Multi-agent, Plugin system, และ Mobile/Desktop

---

## 2. Event System Specification

### 2.1 Event Schema

```typescript
// Base Event — ทุก event ต้องมี
interface BaseEvent {
  id: string;                    // UUID v4
  type: string;                  // "task:created"
  version: number;               // Schema version (1, 2, 3...)
  timestamp: number;             // Unix timestamp ms
  source: string;                // "orchestrator", "agent-1", "system"
  correlationId?: string;        // For tracing across services
  metadata?: Record<string, unknown>;
}
```

### 2.2 Event Lifecycle

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Created │───►│ Validated│───►│ Published│───►│ Processed│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
 Generate UUID   Check Schema   Emit to Bus   Update State
 Set timestamp   Verify type    Route to      Log to store
                 Check version  subscribers   Mark complete
```

#### Event States

| State | Description | Next States |
|-------|-------------|-------------|
| **Created** | Event generated, not yet validated | Validated, Failed |
| **Validated** | Schema validated, ready to publish | Published, Failed |
| **Published** | Emitted to Event Bus | Processed, Failed |
| **Processed** | All handlers completed | Terminal |
| **Failed** | Validation or processing failed | Terminal (logged) |

### 2.3 Event Persistence Strategy

```sql
-- Event Store Table
CREATE TABLE event_store (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,           -- JSON serialized
  timestamp DATETIME NOT NULL,
  source TEXT NOT NULL,
  correlation_id TEXT,
  state TEXT DEFAULT 'created',   -- created/validated/published/processed/failed
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

-- Indexes
CREATE INDEX idx_event_type ON event_store(type);
CREATE INDEX idx_event_timestamp ON event_store(timestamp);
CREATE INDEX idx_event_correlation ON event_store(correlation_id);
CREATE INDEX idx_event_state ON event_store(state);
```

#### Persistence Policy

| Event Type | Persist? | Reason |
|------------|----------|--------|
| task:* | ✅ Yes | Audit trail, recovery |
| agent:* | ✅ Yes | Status tracking |
| memory:* | ✅ Yes | History, debugging |
| system:metric | ⚠️ Optional | High volume, may skip |
| system:alert | ✅ Yes | Critical, must persist |

### 2.4 Ordering & Replay Strategy

#### Ordering Guarantees

```
Within single source:  ✅ Ordered (sequence number)
Across sources:        🟡 Best-effort (timestamp-based)
Global ordering:       ❌ Not guaranteed (distributed)
```

#### Replay Strategy

```
Event Store
    │
    ▼
Replay Request (from timestamp or correlation ID)
    │
    ▼
Filter events (type, time range)
    │
    ▼
Sort by timestamp
    │
    ▼
Re-process in order
    │
    ▼
Update state + log
```

#### Replay Use Cases

| Use Case | How |
|----------|-----|
| **System recovery** | Replay events from last checkpoint |
| **Debugging** | Replay specific correlation ID |
| **Audit** | Query event history |
| **State rebuild** | Replay all events to reconstruct state |

---

## 3. Orchestrator Internal Design

### 3.1 Task State Machine

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Created │───►│ Queued  │───►│Assigned │───►│ Running │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                                     │              │
                                     │              ▼
                                     │         ┌─────────┐
                                     │         │Completed│
                                     │         └─────────┘
                                     │
                                     ▼
                                ┌─────────┐
                                │ Failed  │───► Retry?
                                └─────────┘         │
                                                    ├─ Yes → Reassigned
                                                    └─ No → Dead Letter
```

#### Task States

| State | Description | Transitions |
|-------|-------------|-------------|
| **Created** | Task received, not yet processed | → Queued |
| **Queued** | In priority queue, waiting | → Assigned |
| **Assigned** | Matched to agent, waiting execution | → Running, Failed |
| **Running** | Agent executing | → Completed, Failed |
| **Completed** | Task finished successfully | Terminal |
| **Failed** | Execution failed | → Queued (retry), Dead Letter |
| **Dead Letter** | Max retries exceeded | Terminal (logged) |

### 3.2 Priority Queue System

```typescript
interface PriorityTask {
  task: Task;
  priority: number;      // 1 (highest) to 10 (lowest)
  skillRequired: string[];
  createdAt: number;
  retryCount: number;
}

class PriorityQueue {
  private queue: PriorityTask[] = [];
  
  enqueue(task: Task, priority: number): void {
    const item: PriorityTask = {
      task,
      priority,
      skillRequired: task.requiredSkills,
      createdAt: Date.now(),
      retryCount: 0,
    };
    
    // Insert sorted by priority (lower number = higher priority)
    const insertIndex = this.queue.findIndex(q => q.priority > priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }
  }
  
  dequeue(): PriorityTask | undefined {
    return this.queue.shift();
  }
  
  // Priority calculation
  static calculatePriority(task: Task): number {
    let priority = 5; // default
    
    // Factor 1: Explicit priority
    if (task.priority === 'high') priority -= 2;
    if (task.priority === 'low') priority += 2;
    
    // Factor 2: Age (older = higher priority)
    const age = Date.now() - task.createdAt;
    if (age > 300000) priority -= 1; // > 5 min
    if (age > 600000) priority -= 1; // > 10 min
    
    // Factor 3: Retry count (retry = higher priority)
    if (task.retryCount > 0) priority -= task.retryCount;
    
    return Math.max(1, Math.min(10, priority));
  }
}
```

### 3.3 Scheduling Loop

```
┌─────────────────────────────────────────────────────────┐
│                  Scheduling Loop (1 Hz)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Every 1 second:                                        │
│                                                          │
│  1. Check priority queue                                │
│     └─ If task available AND agent available             │
│        └─ Assign task to agent                          │
│                                                          │
│  2. Check running tasks                                 │
│     └─ If task timeout (> 5 min)                        │
│        └─ Mark as failed, retry or dead letter          │
│                                                          │
│  3. Check agent health                                  │
│     └─ If agent offline > 1 min                         │
│        └─ Reassign its tasks                            │
│                                                          │
│  4. Emit metrics                                        │
│     └─ Queue depth, active agents, throughput           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Conflict Resolution Strategy

```
Conflict Detected
    │
    ▼
Priority Comparison
    │
    ├─ Higher priority wins
    │
    ├─ Same priority → First-come-first-served
    │
    └─ Resource conflict → Queue both, process sequentially
```

#### Conflict Types

| Conflict | Resolution |
|----------|------------|
| **Two agents want same task** | Priority wins |
| **Agent overloaded** | Queue task, wait |
| **Task dependency conflict** | Process dependencies first |
| **Resource lock conflict** | Wait + timeout |

---

## 4. Memory Lifecycle Design

### 4.1 Aging Strategy

```
Working Memory (L1)
    │
    ▼ (every 60 seconds)
Aging Check
    │
    ├─ Items > 5 min old → Move to L2
    │
    ├─ Items > 100 count → Evict oldest
    │
    └─ Items accessed recently → Refresh TTL
```

#### Aging Rules

| Rule | Condition | Action |
|------|-----------|--------|
| **Time-based** | Age > 5 minutes | Promote to L2 |
| **Size-based** | Count > 100 | Evict oldest |
| **Access-based** | Accessed in last 60s | Refresh TTL |
| **Priority-based** | High priority | Never evict |

### 4.2 Eviction Policy

```
Working Memory Full (100 items)
    │
    ▼
Eviction Algorithm (LRU + Priority)
    │
    ├─ 1. Find items with lowest access frequency
    │
    ├─ 2. Among those, find oldest
    │
    ├─ 3. Check priority (high priority = skip)
    │
    └─ 4. Evict lowest priority + oldest
         │
         ▼
    Promote to Long-term Memory (L2)
```

#### Eviction Priority

| Priority | Evict Order | Reason |
|----------|-------------|--------|
| **Low** | First | Least important |
| **Medium** | Second | Default |
| **High** | Third | Important but old |
| **Critical** | Never | Must keep |

### 4.3 Relevance Scoring

```typescript
function calculateRelevance(item: MemoryItem, query: string): number {
  let score = 0;
  
  // Factor 1: Recency (0-30 points)
  const age = Date.now() - item.createdAt;
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  score += 30 * (1 - Math.min(age / maxAge, 1));
  
  // Factor 2: Access frequency (0-30 points)
  const maxAccess = 100;
  score += 30 * Math.min(item.accessCount / maxAccess, 1);
  
  // Factor 3: Keyword match (0-40 points)
  const keywords = query.toLowerCase().split(' ');
  const matches = keywords.filter(k => 
    item.content.toLowerCase().includes(k)
  ).length;
  score += 40 * (matches / keywords.length);
  
  return score; // 0-100
}
```

### 4.4 Retrieval Ranking System

```
Query Received
    │
    ▼
Search All Tiers
    │
    ├──► L1 (Working): Direct lookup
    │
    ├──► L2 (Long-term): SQL query
    │
    └──► L3 (Vector): Semantic search
            │
            ▼
        Merge Results
            │
            ▼
        Calculate Relevance Score (0-100)
            │
            ▼
        Sort by Score (descending)
            │
            ▼
        Return Top N Results
```

#### Retrieval Ranking

| Rank | Score Range | Description |
|------|-------------|-------------|
| **Excellent** | 80-100 | Highly relevant |
| **Good** | 60-79 | Relevant |
| **Fair** | 40-59 | Somewhat relevant |
| **Poor** | 20-39 | Low relevance |
| **Noise** | 0-19 | Not relevant (filtered) |

---

## 5. Agent State Machine

### 5.1 Full Lifecycle States

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Offline │───►│  Idle   │───►│ Working │───►│Completed│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     │              │              ▼              │
     │              │         ┌─────────┐        │
     │              │         │ Paused  │        │
     │              │         └─────────┘        │
     │              │              │              │
     │              ▼              ▼              │
     │         ┌─────────┐    ┌─────────┐       │
     │         │ Register│    │  Error  │       │
     │         └─────────┘    └─────────┘       │
     │              │              │              │
     └──────────────┴──────────────┴──────────────┘
                         │
                         ▼
                   ┌──────────┐
                   │ Offline  │ (shutdown)
                   └──────────┘
```

#### Agent States

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| **Offline** | Not connected | → Register |
| **Register** | Connecting, registering with orchestrator | → Idle, Offline |
| **Idle** | Connected, waiting for task | → Working, Offline |
| **Working** | Executing a task | → Completed, Error, Paused |
| **Paused** | Execution paused (user action) | → Working, Idle |
| **Completed** | Task finished successfully | → Idle |
| **Error** | Execution failed | → Idle (retry), Offline |

### 5.2 Transition Rules

```typescript
interface AgentTransition {
  from: AgentState;
  to: AgentState;
  trigger: string;
  guard?: () => boolean;  // Optional condition
  action?: () => void;    // Optional side effect
}

const AGENT_TRANSITIONS: AgentTransition[] = [
  { from: 'offline', to: 'register', trigger: 'connect' },
  { from: 'register', to: 'idle', trigger: 'registered', guard: () => hasCapability() },
  { from: 'register', to: 'offline', trigger: 'registration_failed' },
  { from: 'idle', to: 'working', trigger: 'task_assigned', guard: () => !isPaused() },
  { from: 'working', to: 'completed', trigger: 'task_finished' },
  { from: 'working', to: 'error', trigger: 'task_failed' },
  { from: 'working', to: 'paused', trigger: 'pause_requested' },
  { from: 'paused', to: 'working', trigger: 'resume_requested' },
  { from: 'paused', to: 'idle', trigger: 'cancel_requested' },
  { from: 'error', to: 'idle', trigger: 'retry' },
  { from: 'error', to: 'offline', trigger: 'max_retries' },
  { from: 'completed', to: 'idle', trigger: 'reset' },
];
```

### 5.3 Failure Recovery Flow

```
Task Fails
    │
    ▼
Agent Error Handler
    │
    ├──► Log error to Event Store
    │
    ├──► Emit "agent:error" event
    │
    └──► Check retry policy
            │
            ├─ Retry count < 3 → Requeue task
            │
            └─ Retry count >= 3 → Dead letter
                    │
                    ▼
                Log to Learning System
                    │
                    ▼
                Notify user (if critical)
```

#### Failure Recovery Matrix

| Failure Type | Recovery | Max Retries |
|--------------|----------|-------------|
| **Timeout** | Reassign to different agent | 3 |
| **Crash** | Requeue task | 3 |
| **Logic error** | Log + alert user | 1 |
| **Network error** | Retry with backoff | 5 |
| **Resource exhausted** | Queue, wait for resource | Unlimited |

### 5.4 Agent Health Monitoring

```
Health Check (every 30 seconds)
    │
    ▼
Agent Status
    │
    ├─ Idle → Healthy ✅
    │
    ├─ Working → Check task duration
    │   ├─ < 5 min → Healthy ✅
    │   └─ > 5 min → Warning ⚠️
    │
    ├─ Error → Unhealthy ❌
    │
    └─ Offline → Dead ☠️
```

---

## 6. High Level Architecture (Updated)

### 6.1 System Context Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User (วุ่น)                           │
│                         │                               │
│                         ▼                               │
│              ┌─────────────────────┐                    │
│              │   Unified Dashboard │                    │
│              │   (Frontend SPA)    │                    │
│              └──────────┬──────────┘                    │
│                         │                               │
│           ┌─────────────┼─────────────┐                 │
│           │             │             │                 │
│           ▼             ▼             ▼                 │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│    │ REST API │  │ WebSocket│  │  Static  │            │
│    └────┬─────┘  └────┬─────┘  └──────────┘            │
│         │              │                                │
│         ▼              ▼                                │
│    ┌─────────────────────────────┐                      │
│    │      Orchestrator Layer     │                      │
│    │  ┌─────┬─────┬─────┐      │                      │
│    │  │Task │Agent│Skill│      │                      │
│    │  │Route│Pool │Match│      │                      │
│    │  └─────┴─────┴─────┘      │                      │
│    └──────────┬──────────────────┘                      │
│               │                                         │
│         ┌─────┼─────┐                                   │
│         ▼     ▼     ▼                                   │
│    ┌─────────────────────────────┐                      │
│    │      Core Services          │                      │
│    │  ┌─────┬─────┬─────┐      │                      │
│    │  │Agent│Mem  │Learn│      │                      │
│    │  │ svc │ svc │ svc │      │                      │
│    │  └─────┴─────┴─────┘      │                      │
│    └──────────┬──────────────────┘                      │
│               │                                         │
│         ┌─────┼─────┐                                   │
│         ▼     ▼     ▼                                   │
│    ┌─────────────────────────────┐                      │
│    │      Data Layer             │                      │
│    │  ┌──────────┐ ┌──────────┐ │                      │
│    │  │Repository│ │  Event   │ │                      │
│    │  │ Pattern  │ │  Store   │ │                      │
│    │  └──────────┘ └──────────┘ │                      │
│    └─────────────────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Technology Stack (Decided)

| Component | Choice | Status | Reason |
|-----------|--------|--------|--------|
| **Frontend** | React + TypeScript | ✅ Decided | Ecosystem, hiring |
| **UI** | Tailwind + shadcn/ui | ✅ Decided | Beautiful, fast |
| **State** | Zustand + React Query | ✅ Decided | Simple, separated |
| **Backend** | Node.js + Fastify | ✅ Decided | Fast, TypeScript |
| **Database** | SQLite (via Drizzle) | ✅ Decided | Simple, file-based |
| **DB Abstraction** | Repository Pattern | ✅ Decided | Future-proof |
| **Cache** | In-memory LRU | ✅ Decided | Fast, simple |
| **WebSocket** | Socket.IO | ✅ Decided | Auto-reconnect |
| **Event Bus** | In-process EventEmitter | ✅ Decided | Fast, simple |
| **Auth** | JWT + Cookie | ✅ Decided | Stateless |
| **Logging** | Pino + SQLite | ✅ Decided | Fast, persistent |
| **Search** | SQLite FTS5 | ✅ Decided | Built-in |

---

## 8. Updated Risk Assessment

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| Orchestrator bottleneck | 🟡 Medium | 🔴 High | Scale to multi-node | 🟡 Hypothesis |
| Memory corruption | 🟡 Medium | 🔴 High | Backup + WAL | 🟡 Hypothesis |
| Event ordering | 🟡 Medium | 🟡 Medium | Correlation IDs | 🟡 Hypothesis |
| Agent failure | 🟡 Medium | 🟡 Medium | Auto-retry + reassign | 🟡 Hypothesis |
| SQLite concurrent writes | 🟡 Medium | 🟡 Medium | Migrate to PostgreSQL | 🟡 Hypothesis |

---

## 9. Assumptions

| Assumption | Status | Proof Method |
|------------|--------|--------------|
| SQLite พอ 50 users | 🟡 Hypothesis | Load test |
| Orchestrator ไม่ bottleneck | 🟡 Hypothesis | Load test |
| 3-tier memory ทำงานได้ | 🟡 Hypothesis | Integration test |
| Event ordering ถูกต้อง | 🟡 Hypothesis | Unit test |
| Stateless agents ทำงานได้ | 🟡 Hypothesis | Integration test |
| WebSocket latency < 100ms | 🟡 Hypothesis | Benchmark |

---

**End of Architecture Document v3**
**Status**: ✅ Approved — Ready for Milestone 2
**Next**: Update decisions.md + roadmap.md แล้วเริ่ม Milestone 2
