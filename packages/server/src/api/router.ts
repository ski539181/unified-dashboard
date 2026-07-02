// API Layer — Express/Fastify routes for task management
import { Router, Request, Response } from 'express';
import { Orchestrator } from '../modules/orchestrator/orchestrator';
import { EventBus } from '../event/bus';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function createApiRouter(orchestrator: Orchestrator, eventBus: EventBus, eventStore: any): Router {
  const router = Router();

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Create task
  router.post('/tasks', async (req: Request, res: Response) => {
    try {
      const { title, description, priority, requiredSkills } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const task = await orchestrator.createTask(
        title,
        description,
        priority || 5,
        requiredSkills || []
      );

      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get task
  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = orchestrator['taskManager'].getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  });

  // Get all tasks
  router.get('/tasks', (req: Request, res: Response) => {
    const tasks = orchestrator['taskManager'].getAllTasks();
    res.json(tasks);
  });

  // Get stats
  router.get('/stats', (req: Request, res: Response) => {
    const stats = orchestrator.getStats();
    res.json(stats);
  });

  // Get events
  router.get('/events', async (req: Request, res: Response) => {
    const { type, from, to, correlationId } = req.query;
    const events = await eventStore.query({
      type: type as string,
      from: from ? parseInt(from as string) : undefined,
      to: to ? parseInt(to as string) : undefined,
      correlationId: correlationId as string,
    });
    res.json(events);
  });

  // TokenSlim stats
  router.get('/tokenslim', (req: Request, res: Response) => {
    try {
      const statsPath = join(homedir(), '.hermes', 'tokenslim_stats.json');
      const data = readFileSync(statsPath, 'utf-8');
      res.json(JSON.parse(data));
    } catch (error) {
      // Return default stats if file doesn't exist
      res.json({
        l1_tokslim: { total_calls: 0, avg_savings_pct: 0 },
        l2_cache: { total_checks: 0, hit_rate: 0, total_entries: 0 },
        l3_memory: { total_injects: 0, total_stores: 0 },
        l4_taskqueue: { total_tracked: 0 },
        l5_ocl: { total_trims: 0, avg_savings_pct: 0 },
        updated_at: null,
      });
    }
  });

  return router;
}
