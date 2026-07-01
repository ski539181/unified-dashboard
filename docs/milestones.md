# Milestones — Hermes AI OS Backend (Unified Dashboard)

> Single source of truth for all milestones.
> Last updated: 2026-07-01

---

## Status Legend

| Status | ความหมาย |
|--------|----------|
| `LOCKED` | ผ่าน regression review, ห้ามแก้ไข except bug fix |
| `IN PROGRESS` | กำลังพัฒนา |
| `PLANNED` | ยังไม่เริ่ม |

---

## Milestone 1 — Event-Driven Foundation

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | สร้าง event-driven architecture ที่ Modules ทั้งหมดสื่อสารกันผ่าน EventBus เท่านั้น |
| **What was built** | `event/bus.ts` — EventBus (pub/sub) + EventStore (append-only) |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed |

---

## Milestone 2 — Task System

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | สร้าง task management ด้วย state machine + priority queue + retry logic |
| **What was built** | `modules/task/task-manager.ts` — Task state machine, priority queue, retry with dead letter |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed |

---

## Milestone 3 — Agent System

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | สร้าง stateless agents ที่มี capabilities, health score, และ state machine |
| **What was built** | `modules/agent/agent-pool.ts` — Agent pool, capabilities matching, state machine, executor interface |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed |

---

## Milestone 4 — Runtime Layer

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | สร้าง orchestrator ที่เชื่อม task + agent เข้าด้วยกัน + REST API + WebSocket broadcast |
| **What was built** | `modules/orchestrator/orchestrator.ts` — Main loop (1Hz tick), task routing, timeout check. `api/router.ts` — Express REST endpoints. Socket.IO real-time event broadcast. |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed |

---

## Milestone 5 — Core Intelligence Layer

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | สร้าง intelligence layer ที่ทำงานบน event-driven architecture เดิม — Memory, Skills, Learning, Self-improvement |
| **What was built** | `modules/memory/memory-manager.ts` — 3-tier memory (Working → Long-term → Vector TF-IDF). `modules/skill/skill-evaluator.ts` — Health score 0–100, usage tracking, recommendations. `modules/learning/learning-loop.ts` — Pattern detection, lesson generation. `modules/learning/self-improvement.ts` — Metrics collection, auto-improvement actions. `api/intelligence-router.ts` — REST API for all M5 modules. |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed |

---

## Milestone 6 — Persistence Layer (SQLite)

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | เพิ่ม persistent storage ด้วย SQLite — ให้ข้อมูล Tasks, Agents, Memory, Skills, Learning รอดระหว่าง restart |
| **What was built** | `persistence/database.ts` — Single SQLite instance, schema init, transactions. `persistence/event-store-db.ts` — EventStore → SQLite (source of truth). `persistence/task-store.ts` — Task CRUD. `persistence/agent-store.ts` — Agent CRUD. `persistence/memory-store.ts` — Memory CRUD + search. `persistence/skill-store.ts` — Skill CRUD. `persistence/learning-store.ts` — Lesson CRUD. `persistence/metrics-store.ts` — Metrics CRUD. `persistence/index.ts` — Export barrel. |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed (Build + E2E + M5 + M6 tests) |

---

## Milestone 7 — Self-Healing System

| | |
|---|---|
| **Status** | `LOCKED` |
| **Goal** | Generic Runtime Self-Healing — ตรวจจับความผิดปกติจาก metrics, วิเคราะห์สาเหตุ, แก้ไขอัตโนมัติ, log ทุกขั้นตอน |
| **What was built** | `modules/healing/types.ts` — Types: Anomaly, Diagnosis, HealingLog, EffectivenessRecord. `modules/healing/metrics-collector.ts` — Collect real metrics from TaskManager/AgentPool/EventBus. `modules/healing/detector.ts` — Detect anomalies from thresholds. `modules/healing/diagnoser.ts` — Root cause analysis. `modules/healing/actions.ts` — Action functions (clearDeadLetters, restartErrorAgents, enableBackpressure, reduceSendRate). `modules/healing/learner.ts` — Effectiveness tracking + best action recommendation. `modules/healing/self-healer.ts` — Main engine (tick loop, cooldown, dry-run, alerts). |
| **Locked date** | 2026-07-01 |
| **Regression** | ✅ Passed (Build + E2E + M5 + M6 + M7 tests) |

---

## Architecture Principles

1. **Event-driven only** — Modules communicate via EventBus, never directly
2. **No external AI services** — Open-source only, pure algorithms
3. **M1-M6 locked** — No modification except real bug fixes
4. **M1-M7 locked** — No modification except real bug fixes
5. **EventStore = source of truth** — All other tables are read models, replayable from events
6. **Single Database instance** — All stores share one SQLite connection
7. **Transactions for consistency** — Multi-step writes wrapped in transactions
7. **Workflow per milestone**: Architecture Review → Implementation → Build+Test → Regression → LOCK
