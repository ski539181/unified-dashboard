# Hermes AI OS — Backend Core System

## Overview

Backend system สำหรับ Hermes AI OS Unified Dashboard — รองรับ task management, agent orchestration, event-driven architecture

## Architecture

```
User Request
    │
    ▼
┌─────────────────────────────────────────┐
│           API Layer (Express)           │
│  POST /api/tasks                        │
│  GET  /api/tasks/:id                    │
│  GET  /api/stats                        │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│         Orchestrator (1 Hz loop)        │
│  - Skill-based routing                  │
│  - Priority queue                       │
│  - Task state machine                   │
│  - Failure handling                     │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Agent Pool │ │ Task Mgr   │ │ Event Bus  │
│ (Stateless)│ │ (Queue)    │ │ (Runtime)  │
└────────────┘ └────────────┘ └────────────┘
         │         │         │
         ▼         ▼         ▼
┌─────────────────────────────────────────┐
│           Event Store                   │
│  (Append-only, ordered)                 │
└─────────────────────────────────────────┘
```

## Flow

```
1. User sends task via API
2. Task enters queue
3. Orchestrator picks task from queue
4. Orchestrator finds available agent (skill-based)
5. Orchestrator assigns task to agent
6. Agent executes task
7. Agent returns result
8. Orchestrator marks task as completed
9. Event emitted at each step
10. Result stored in memory
```

## Files

```
packages/server/src/
├── index.ts                          # Entry point
├── api/
│   └── router.ts                     # Express routes
├── event/
│   └── bus.ts                        # Event Bus + Event Store
├── modules/
│   ├── task/
│   │   └── task-manager.ts           # Task system
│   ├── agent/
│   │   └── agent-pool.ts             # Agent system
│   └── orchestrator/
│       └── orchestrator.ts           # Orchestrator engine
└── test/
    └── e2e.test.ts                   # End-to-end test
```

## How to Run

```bash
cd packages/server
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /api/tasks | Create task |
| GET | /api/tasks/:id | Get task |
| GET | /api/tasks | Get all tasks |
| GET | /api/stats | Get orchestrator stats |
| GET | /api/events | Get events |

## Test

```bash
cd packages/server
npx tsx src/test/e2e.test.ts
```

## Status

✅ Event Bus (runtime)
✅ Task System (state machine, queue, retry)
✅ Agent Pool (stateless, skill-based)
✅ Orchestrator (routing, scheduling, failure handling)
✅ API Layer (Express routes)

🔴 Database persistence (Milestone 2 schema exists, not wired yet)
🔴 WebSocket (Milestone 4)
🔴 Memory Writer (Milestone 5)
