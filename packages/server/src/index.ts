// Main Server — Entry point for Hermes AI OS Backend
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventBus, EventStore } from './event/bus';
import { TaskManager } from './modules/task/task-manager';
import { AgentPool, MockAgentExecutor } from './modules/agent/agent-pool';
import { Orchestrator } from './modules/orchestrator/orchestrator';
import { MemoryManager } from './modules/memory/memory-manager';
import { SkillEvaluator } from './modules/skill/skill-evaluator';
import { LearningLoop } from './modules/learning/learning-loop';
import { SelfImprovement } from './modules/learning/self-improvement';
import { createApiRouter } from './api/router';
import { createIntelligenceRouter } from './api/intelligence-router';
import { SelfHealer } from './modules/healing';
import {
  DatabaseManager,
  EventStoreDB,
  TaskStore,
  AgentStore,
  MemoryStore,
  SkillStore,
  LearningStore,
  MetricsStore,
} from './persistence';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

async function main() {
  console.log('🚀 Starting Hermes AI OS Backend...');

  // ==================== Persistence Layer ====================
  let db: DatabaseManager | null = null;
  let eventStoreDB: EventStoreDB | null = null;
  let taskStore: TaskStore | null = null;
  let agentStore: AgentStore | null = null;
  let memoryStore: MemoryStore | null = null;
  let skillStore: SkillStore | null = null;
  let learningStore: LearningStore | null = null;
  let metricsStore: MetricsStore | null = null;

  try {
    db = new DatabaseManager();
    eventStoreDB = new EventStoreDB(db);
    taskStore = new TaskStore(db);
    agentStore = new AgentStore(db);
    memoryStore = new MemoryStore(db);
    skillStore = new SkillStore(db);
    learningStore = new LearningStore(db);
    metricsStore = new MetricsStore(db);
    console.log('💾 SQLite connected');
  } catch (error) {
    console.warn('⚠️ SQLite unavailable, using in-memory mode:', (error as Error).message);
  }

  // ==================== Core Infrastructure ====================
  // EventStore: prefer SQLite, fallback to in-memory
  const eventStore = db && eventStoreDB
    ? { append: (e: any) => eventStoreDB!.append(e), query: (f: any) => eventStoreDB!.query(f), getSequence: () => eventStoreDB!.getSequence() }
    : new EventStore();
  
  const eventBus = new EventBus(eventStore as any);
  const taskManager = new TaskManager(eventBus);
  const agentPool = new AgentPool(eventBus);

  await agentPool.registerAgent(
    'MockAgent-1',
    ['general', 'coding', 'research'],
    new MockAgentExecutor()
  );

  // Persist agent to SQLite if available
  if (agentStore) {
    const agent = agentPool.getAgent('MockAgent-1') || agentPool.getAllAgents()[0];
    if (agent) agentStore.save(agent);
  }

  const orchestrator = new Orchestrator(eventBus, taskManager, agentPool);

  // ==================== Milestone 5: Intelligence Layer ====================
  const memoryManager = new MemoryManager(eventBus);
  const skillEvaluator = new SkillEvaluator(eventBus);
  const learningLoop = new LearningLoop(eventBus);
  const selfImprovement = new SelfImprovement(eventBus);

  // ==================== Milestone 7: Self-Healing ====================
  const selfHealer = new SelfHealer(taskManager, agentPool, orchestrator, eventBus);

  // ==================== Event Sync to SQLite ====================
  // When events are emitted, also persist to SQLite read models
  if (db && taskStore && agentStore && memoryStore && skillStore && learningStore && metricsStore) {
    eventBus.on('task:created', async (event) => {
      const task = taskManager.getTask(event.payload.taskId as string);
      if (task) taskStore!.save(task);
    });

    eventBus.on('task:assigned', async (event) => {
      const task = taskManager.getTask(event.payload.taskId as string);
      if (task) taskStore!.save(task);
    });

    eventBus.on('task:started', async (event) => {
      const task = taskManager.getTask(event.payload.taskId as string);
      if (task) taskStore!.save(task);
    });

    eventBus.on('task:completed', async (event) => {
      const task = taskManager.getTask(event.payload.taskId as string);
      if (task) taskStore!.save(task);
    });

    eventBus.on('task:failed', async (event) => {
      const task = taskManager.getTask(event.payload.taskId as string);
      if (task) taskStore!.save(task);
    });

    eventBus.on('task:retry', async (event) => {
      const task = taskManager.getTask(event.payload.taskId as string);
      if (task) taskStore!.save(task);
    });

    eventBus.on('agent:status_changed', async (event) => {
      const agents = agentPool.getAllAgents();
      for (const agent of agents) {
        agentStore!.save(agent);
      }
    });

    eventBus.on('memory:written', async (event) => {
      // Memory is managed in-memory by MemoryManager
      // SQLite sync happens via memory:promoted event
    });

    eventBus.on('memory:promoted', async (event) => {
      // Sync promoted memories to SQLite
      const stats = memoryManager.getStats();
      console.log(`💾 Memory promoted: ${stats.total} total entries`);
    });

    eventBus.on('skill:updated', async (event) => {
      const { agentId, skill } = event.payload as { agentId: string; skill: string };
      const skillRecord = skillEvaluator.getSkill(agentId, skill);
      if (skillRecord) skillStore!.save(skillRecord);
    });

    eventBus.on('learning:lesson_generated', async (event) => {
      const { lessonId } = event.payload as { lessonId: string };
      const lesson = learningLoop.getLesson(lessonId);
      if (lesson) learningStore!.saveLesson(lesson);
    });

    console.log('🔄 SQLite event sync enabled');
  }

  // ==================== Express + WebSocket ====================
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Subscribe to ALL event types and broadcast via WebSocket
  const eventTypes = [
    'task:created', 'task:assigned', 'task:started', 
    'task:completed', 'task:failed', 'task:retry', 'task:dead_letter',
    'agent:registered', 'agent:status_changed', 'agent:error',
    'memory:updated',
    'memory:written', 'memory:promoted', 'memory:compress',
    'skill:updated', 'skill:optimize',
    'learning:analyzed', 'learning:failure_analyzed', 
    'learning:lesson_generated', 'learning:lesson_applied', 'learning:error_lesson_generated',
    'improvement:metrics_collected', 'improvement:action_generated', 
    'improvement:action_executed', 'improvement:action_failed',
    'agent:rebalance',
    'healing:action_executed', 'healing:alert',
    'healing:dead_letter_removed', 'healing:agent_restarted',
    'healing:backpressure_enabled', 'healing:send_rate_reduced',
  ];
  
  for (const type of eventTypes) {
    eventBus.on(type, async (event) => {
      io.emit('event', event);
    });
  }

  // ==================== API Routes ====================
  app.use('/api', createApiRouter(orchestrator, eventBus, eventStore));
  app.use('/api/intelligence', createIntelligenceRouter(
    memoryManager,
    skillEvaluator,
    learningLoop,
    selfImprovement,
    eventBus
  ));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      version: '4.0.0', // M7 release
      persistence: db ? 'sqlite' : 'in-memory',
      modules: {
        orchestrator: orchestrator.getStats(),
        memory: memoryManager.getStats(),
        skills: skillEvaluator.getStats(),
        learning: learningLoop.getMetrics(),
        improvement: selfImprovement.getStats(),
        selfHealer: selfHealer.getStatus(),
      },
      websocket: io.engine.clientsCount,
    });
  });

  // ==================== Start ====================
  orchestrator.start();
  selfHealer.start();

  httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log(`🧠 Intelligence API: http://localhost:${PORT}/api/intelligence`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}/socket.io`);
    console.log(`💾 Persistence: ${db ? 'SQLite' : 'In-Memory'}`);
  });

  process.on('SIGINT', () => {
    orchestrator.stop();
    selfHealer.stop();
    io.close();
    if (db) db.close();
    process.exit(0);
  });
}

main().catch(console.error);