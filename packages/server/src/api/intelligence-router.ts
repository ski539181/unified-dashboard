// Intelligence API — Routes for memory, skills, learning, self-improvement
import { Router, Request, Response } from 'express';
import { MemoryManager } from '../modules/memory/memory-manager';
import { SkillEvaluator } from '../modules/skill/skill-evaluator';
import { LearningLoop } from '../modules/learning/learning-loop';
import { SelfImprovement } from '../modules/learning/self-improvement';
import { EventBus } from '../event/bus';

export function createIntelligenceRouter(
  memoryManager: MemoryManager,
  skillEvaluator: SkillEvaluator,
  learningLoop: LearningLoop,
  selfImprovement: SelfImprovement,
  eventBus: EventBus
): Router {
  const router = Router();

  // ==================== Memory Routes ====================

  // Search memory across all tiers
  router.get('/memory/search', (req: Request, res: Response) => {
    const { query, topK } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = memoryManager.search(query as string, parseInt(topK as string) || 10);
    res.json(results);
  });

  // Write to memory
  router.post('/memory/write', (req: Request, res: Response) => {
    const { content, metadata, tags, tier } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    let entry;
    if (tier) {
      entry = memoryManager.writeToTier(tier, content, metadata || {}, tags || []);
    } else {
      entry = memoryManager.write(content, metadata || {}, tags || []);
    }

    res.status(201).json(entry);
  });

  // Get memory stats
  router.get('/memory/stats', (req: Request, res: Response) => {
    const stats = memoryManager.getStats();
    res.json(stats);
  });

  // Compress working memory
  router.post('/memory/compress', (req: Request, res: Response) => {
    memoryManager.compress();
    res.json({ status: 'compressed', stats: memoryManager.getStats() });
  });

  // ==================== Skill Routes ====================

  // Get all skills
  router.get('/skills', (req: Request, res: Response) => {
    const skills = skillEvaluator.getAllSkills();
    res.json(skills);
  });

  // Get skills for specific agent
  router.get('/skills/agent/:agentId', (req: Request, res: Response) => {
    const skills = skillEvaluator.getAgentSkills(req.params.agentId);
    res.json(skills);
  });

  // Get weak skills
  router.get('/skills/weak', (req: Request, res: Response) => {
    const { threshold } = req.query;
    const skills = skillEvaluator.getWeakSkills(parseInt(threshold as string) || 30);
    res.json(skills);
  });

  // Get unused skills
  router.get('/skills/unused', (req: Request, res: Response) => {
    const { days } = req.query;
    const skills = skillEvaluator.getUnusedSkills(parseInt(days as string) || 7);
    res.json(skills);
  });

  // Get skill recommendations
  router.get('/skills/recommendations', (req: Request, res: Response) => {
    const recommendations = skillEvaluator.generateRecommendations();
    res.json(recommendations);
  });

  // Get skill stats
  router.get('/skills/stats', (req: Request, res: Response) => {
    const stats = skillEvaluator.getStats();
    res.json(stats);
  });

  // ==================== Learning Routes ====================

  // Get all lessons
  router.get('/learning/lessons', (req: Request, res: Response) => {
    const lessons = learningLoop.getAllLessons();
    res.json(lessons);
  });

  // Get lessons by category
  router.get('/learning/lessons/category/:category', (req: Request, res: Response) => {
    const lessons = learningLoop.getLessonsByCategory(req.params.category as any);
    res.json(lessons);
  });

  // Apply a lesson
  router.post('/learning/lessons/:lessonId/apply', async (req: Request, res: Response) => {
    await learningLoop.applyLesson(req.params.lessonId);
    res.json({ status: 'applied', lessonId: req.params.lessonId });
  });

  // Get all patterns
  router.get('/learning/patterns', (req: Request, res: Response) => {
    const patterns = learningLoop.getAllPatterns();
    res.json(patterns);
  });

  // Get learning metrics
  router.get('/learning/metrics', (req: Request, res: Response) => {
    const metrics = learningLoop.getMetrics();
    res.json(metrics);
  });

  // ==================== Self-improvement Routes ====================

  // Get metrics history
  router.get('/improvement/metrics', (req: Request, res: Response) => {
    const history = selfImprovement.getMetricsHistory();
    res.json(history);
  });

  // Get latest metrics
  router.get('/improvement/metrics/latest', (req: Request, res: Response) => {
    const metrics = selfImprovement.getLatestMetrics();
    res.json(metrics || {});
  });

  // Get pending actions
  router.get('/improvement/actions', (req: Request, res: Response) => {
    const actions = selfImprovement.getPendingActions();
    res.json(actions);
  });

  // Get improvement stats
  router.get('/improvement/stats', (req: Request, res: Response) => {
    const stats = selfImprovement.getStats();
    res.json(stats);
  });

  return router;
}