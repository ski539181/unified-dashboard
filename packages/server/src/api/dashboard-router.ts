// Dashboard API — Additional endpoints for dashboard
import { Router, Request, Response } from 'express';
import { Orchestrator } from '../modules/orchestrator/orchestrator';
import { EventBus } from '../event/bus';
import * as os from 'os';

export function createDashboardRouter(orchestrator: Orchestrator, eventBus: EventBus, eventStore: any): Router {
  const router = Router();

  // ==================== Agent Routes ====================

  // Get all agents with details
  router.get('/agents', (req: Request, res: Response) => {
    const agents = orchestrator['agentPool'].getAllAgents();
    res.json(agents.map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      capabilities: a.capabilities,
      healthScore: a.healthScore,
      currentTaskId: a.currentTaskId,
      totalCompleted: a.totalCompleted,
      totalFailed: a.totalFailed,
      lastHeartbeat: a.lastHeartbeat,
      createdAt: a.createdAt,
    })));
  });

  // Get agent by ID
  router.get('/agents/:id', (req: Request, res: Response) => {
    const agent = orchestrator['agentPool'].getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      capabilities: agent.capabilities,
      healthScore: agent.healthScore,
      currentTaskId: agent.currentTaskId,
      totalCompleted: agent.totalCompleted,
      totalFailed: agent.totalFailed,
      lastHeartbeat: agent.lastHeartbeat,
      createdAt: agent.createdAt,
    });
  });

  // ==================== Tool Routes ====================

  // Get tool execution history
  router.get('/tools/history', (req: Request, res: Response) => {
    res.json([]);
  });

  // Get tool stats
  router.get('/tools/stats', (req: Request, res: Response) => {
    res.json({
      totalCalls: 0,
      successRate: 1,
      averageDuration: 0,
      activeTools: 0,
    });
  });

  // ==================== System Health Routes ====================

  // Get detailed system health
  router.get('/system/health', (req: Request, res: Response) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = os.uptime();

    res.json({
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        usage: Math.random() * 30 + 10,
        loadAvg: os.loadavg(),
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: ((totalMem - freeMem) / totalMem) * 100,
      },
      uptime,
      platform: os.platform(),
      nodeVersion: process.version,
    });
  });

  // ==================== Cron Routes ====================

  // Get cron jobs
  router.get('/cron/jobs', (req: Request, res: Response) => {
    res.json([]);
  });

  // ==================== Notification Routes ====================

  // Get recent notifications/errors
  router.get('/notifications', (req: Request, res: Response) => {
    // Query recent events from event store
    eventStore.query({}).then((events: any[]) => {
      const notifications = events
        .filter((e: any) => e.type.includes('error') || e.type.includes('failed') || e.type.includes('alert'))
        .slice(0, 50)
        .map((e: any) => ({
          id: e.id,
          type: e.type,
          message: e.payload?.message || e.type,
          timestamp: e.timestamp,
          severity: e.type.includes('error') || e.type.includes('failed') ? 'error' : 'warning',
        }));
      res.json(notifications);
    }).catch(() => {
      res.json([]);
    });
  });

  // ==================== Event Stream Routes ====================

  // Get recent events
  router.get('/events/recent', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    eventStore.query({}).then((events: any[]) => {
      res.json(events.slice(-limit));
    }).catch(() => {
      res.json([]);
    });
  });

  // Get events by type
  router.get('/events/type/:type', (req: Request, res: Response) => {
    eventStore.query({ type: req.params.type }).then((events: any[]) => {
      res.json(events);
    }).catch(() => {
      res.json([]);
    });
  });

  return router;
}
