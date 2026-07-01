# Unified Dashboard — Architectural Decisions (Updated)

**Version**: 3.0.0
**Date**: 2026-07-01
**Status**: ✅ Approved — Ready for Milestone 2

---

## Decision Log Format

แต่ละ decision ประกอบด้วย:
1. **ปัญหา** — กำลังจะแก้ปัญหาอะไร
2. **ทางเลือก** — มีทางเลือกอะไรบ้าง
3. **ข้อดี/ข้อเสีย** — ของแต่ละทางเลือก
4. **ความเสี่ยง** — ของแต่ละทางเลือก
5. **เหตุผลที่เลือก** — ทำไมเลือกทางนี้
6. **สิ่งที่อาจเปลี่ยน** — ถ้าอนาคตข้อมูลเปลี่ยน

---

## D1: Frontend Framework ✅ Decided

### ปัญหา
เลือก frontend framework สำหรับ dashboard

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **React + TypeScript** | Ecosystem ใหญ่, หางานง่าย | Bundle ใหญ่ |
| **Vue 3 + TypeScript** | ง่ายกว่า | Ecosystem เล็กกว่า |
| **Svelte + TypeScript** | เร็ว, bundle เล็ก | Ecosystem เล็ก |

### เหตุผลที่เลือก: **React + TypeScript**
- Ecosystem ใหญ่สุด → หา component ได้ง่าย
- หางานง่าย → ถ้าต้องจ้างคนมาช่วย
- shadcn/ui มีให้ใช้ → ลดเวลาออกแบบ UI

---

## D2: Backend Framework ✅ Decided

### ปัญหา
เลือก backend framework

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Node.js + Fastify** | เร็ว, TypeScript | Single-threaded |
| **Go + Gin** | เร็วมาก, concurrent | ต้องเรียน Go |
| **Rust + Actix** | เร็วที่สุด | ช้าในการพัฒนา |

### เหตุผลที่เลือก: **Node.js + Fastify**
- เร็วกว่า Express 2x
- TypeScript ได้เหมือนกัน → code sharing
- WebSocket support ดี

---

## D3: Database ✅ Decided

### ปัญหา
เลือก database

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **SQLite** | Simple, no server | Concurrent write limit |
| **PostgreSQL** | Feature-rich, scalable | ต้อง setup server |

### เหตุผลที่เลือก: **SQLite (with Pluggable Layer)**
- ง่ายที่สุดสำหรับ MVP
- Repository Pattern → เปลี่ยน PostgreSQL ได้
- WAL mode → concurrent read ได้

### Migration Rule
- เริ่ม SQLite
- ย้าย PostgreSQL เมื่อ: multi-node, ~50+ users, ~100+ agents

---

## D4: Event System ✅ Decided

### ปัญหา
จะจัดการ events ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **In-process EventEmitter** | เร็วสุด, simple | ไม่ persistent |
| **Redis Pub/Sub** | Persistent, scalable | ต้อง setup Redis |
| **Kafka** | Persistent, ordered, scalable | ซับซ้อนมาก |

### เหตุผลที่เลือก: **In-process EventEmitter + Optional Event Store**
- เร็วที่สุดสำหรับ in-app events
- Event Store (optional) → persist สำหรับ replay
- ไม่ต้อง dependency เพิ่ม

### Event Persistence
- task:*, agent:*, memory:* → Persist
- system:metric → Optional (high volume)

---

## D5: Orchestrator ✅ Decided

### ปัญหา
จะจัดการ task routing ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Single-node orchestrator** | Simple, fast | ไม่ scalable |
| **Distributed orchestrator** | Scalable | ซับซ้อน |
| **No orchestrator (direct)** | Simple | ไม่มี routing |

### เหตุผลที่เลือก: **Single-node (start), future-ready for distributed**
- ง่ายที่สุดสำหรับ 1-100 users
- Skill-based + Priority hybrid routing
- 1:N concurrency (task can spawn subtasks)
- Auto-retry (max 3) + reassign

---

## D6: Agent Model ✅ Decided

### ปัญหา
จะ design agents ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Stateless agents** | Simple, no state sync | ต้อง load context ทุกครั้ง |
| **Stateful agents** | Faster execution | ต้อง sync state |

### เหตุผลที่เลือก: **Stateless**
- ไม่มี state sync problem
- ง่ายต่อ retry/reassign
- ทุก state อยู่ใน Orchestrator/Memory

### Communication
- Event Bus only (ไม่มี direct agent-to-agent)
- Shared Memory Service (ไม่มี private memory)

---

## D7: Memory System ✅ Decided

### ปัญหา
จะจัดการ memory ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **1-tier (flat)** | Simple | ไม่มี hierarchy |
| **2-tier (working + long-term)** | Better | ไม่มี semantic search |
| **3-tier (working + long-term + vector)** | Best | ซับซ้อนกว่า |

### เหตุผลที่เลือก: **3-tier**
- Working: fast access, 100 items
- Long-term: persistent, query
- Vector: semantic search

### Memory Lifecycle
- Aging: working → long-term after 5 min
- Eviction: LRU + priority
- Compression: rule-based + LLM summarization

---

## D8: State Management ✅ Decided

### ปัญหา
จะจัดการ state ของ frontend ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Zustand + React Query** | Simple, separated | Ecosystem เล็กกว่า |
| **Redux Toolkit** | Feature-rich | Boilerplate เยอะ |

### เหตุผลที่เลือก: **Zustand + React Query**
- Zustand → client state
- React Query → server state + caching
- แยก concerns ชัดเจน

---

## D9: WebSocket ✅ Decided

### ปัญหา
จะส่ง real-time updates ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Socket.IO** | Auto-reconnect, fallback | Bundle ใหญ่ |
| **ws (raw)** | เล็ก, เร็ว | ต้อง handle reconnect เอง |

### เหตุผลที่เลือก: **Socket.IO**
- Auto-reconnect ในตัว
- Fallback to polling
- หางานง่าย

---

## D10: Authentication ✅ Decided

### ปัญหา
จะ auth ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **JWT + Cookie** | Stateless, simple | Token expiry |
| **Session + Cookie** | Simple | Server-side state |

### เหตุผลที่เลือก: **JWT + Cookie**
- Stateless → ง่ายต่อ scaling
- Cookie → secure, httpOnly

---

## D11: Plugin System ✅ Decided

### ปัญหา
จะรองรับ plugin ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Dynamic import** | Simple, native JS | Security risk |
| **Sandboxed modules** | Secure | ซับซ้อน |

### เหตุผลที่เลือก: **Dynamic import (simple)**
- ง่ายที่สุด
- Plugin มาจาก trusted source

---

## D12: DB Abstraction ✅ Decided

### ปัญหา
จะ abstract database ยังไง

### ทางเลือก

| Option | ข้อดี | ข้อเสีย |
|--------|-------|---------|
| **Repository Pattern** | Clean abstraction | ต้อง implement ทุก DB |
| **ORM (Prisma/Drizzle)** | Auto-generate | ซับซ้อน |

### เหตุผลที่เลือก: **Repository Pattern + Drizzle**
- Repository → clean interface
- Drizzle → query builder, type-safe
- เปลี่ยน DB ได้ง่าย

---

## Summary

| Decision | Choice | Status |
|----------|--------|--------|
| Frontend | React + TypeScript | ✅ Decided |
| Backend | Node.js + Fastify | ✅ Decided |
| Database | SQLite (Pluggable) | ✅ Decided |
| Event System | In-process + Event Store | ✅ Decided |
| Orchestrator | Single-node, Skill-based | ✅ Decided |
| Agent Model | Stateless, Event Bus | ✅ Decided |
| Memory | 3-tier (Working + Long-term + Vector) | ✅ Decided |
| State | Zustand + React Query | ✅ Decided |
| WebSocket | Socket.IO | ✅ Decided |
| Auth | JWT + Cookie | ✅ Decided |
| Plugin | Dynamic import | ✅ Decided |
| DB Abstraction | Repository Pattern + Drizzle | ✅ Decided |

**All decisions are DECIDED (not inferred/hypothesis)** ✅

---

**End of Decisions Document v3**
**Status**: ✅ Approved — Ready for Milestone 2
