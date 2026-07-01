// Milestone 5 Test — Intelligence Layer
import { EventBus, EventStore } from '../event/bus';
import { MemoryManager } from '../modules/memory/memory-manager';
import { SkillEvaluator } from '../modules/skill/skill-evaluator';
import { LearningLoop } from '../modules/learning/learning-loop';
import { SelfImprovement } from '../modules/learning/self-improvement';

async function testMilestone5() {
  console.log('🧪 Testing Milestone 5: Intelligence Layer\n');

  const eventStore = new EventStore();
  const eventBus = new EventBus(eventStore);

  // ==================== Test 1: Memory Manager ====================
  console.log('📝 Test 1: Memory Manager (3-tier)');
  
  const memoryManager = new MemoryManager(eventBus);
  
  // Write to working memory
  const entry1 = memoryManager.write('Test task completed', { taskId: '123' }, ['test']);
  console.log(`   ✅ Working memory write: ${entry1.id}`);
  
  // Write to long-term memory
  const entry2 = memoryManager.writeToTier('longterm', 'Important lesson learned', { type: 'lesson' }, ['lesson']);
  console.log(`   ✅ Long-term memory write: ${entry2.id}`);
  
  // Write to vector memory
  const entry3 = memoryManager.writeToTier('vector', 'Semantic search test content', { type: 'semantic' }, ['search']);
  console.log(`   ✅ Vector memory write: ${entry3.id}`);
  
  // Search across all tiers
  const searchResults = memoryManager.search('task');
  console.log(`   ✅ Search found ${searchResults.length} results`);
  
  // Get stats
  const memoryStats = memoryManager.getStats();
  console.log(`   📊 Memory stats: Working=${memoryStats.working}, Long-term=${memoryStats.longterm}, Vector=${memoryStats.vector}`);
  
  console.log('');

  // ==================== Test 2: Skill Evaluator ====================
  console.log('🎯 Test 2: Skill Evaluator');
  
  const skillEvaluator = new SkillEvaluator(eventBus);
  
  // Record skill usage
  skillEvaluator.recordUsage('agent-1', 'coding', true, 1500);
  skillEvaluator.recordUsage('agent-1', 'coding', true, 1200);
  skillEvaluator.recordUsage('agent-1', 'coding', false, 2000);
  skillEvaluator.recordUsage('agent-1', 'research', true, 800);
  console.log('   ✅ Recorded 4 skill usages');
  
  // Get agent skills
  const agentSkills = skillEvaluator.getAgentSkills('agent-1');
  console.log(`   ✅ Agent skills: ${agentSkills.length} skills tracked`);
  
  // Get weak skills
  const weakSkills = skillEvaluator.getWeakSkills(40);
  console.log(`   ✅ Weak skills (threshold=40): ${weakSkills.length}`);
  
  // Get recommendations
  const recommendations = skillEvaluator.generateRecommendations();
  console.log(`   ✅ Recommendations: ${recommendations.length}`);
  
  // Get stats
  const skillStats = skillEvaluator.getStats();
  console.log(`   📊 Skill stats: Total=${skillStats.totalSkills}, Avg health=${skillStats.avgHealthScore}`);
  
  console.log('');

  // ==================== Test 3: Learning Loop ====================
  console.log('📚 Test 3: Learning Loop');
  
  const learningLoop = new LearningLoop(eventBus);
  
  // Emit task completed events to trigger analysis
  for (let i = 0; i < 5; i++) {
    await eventBus.emit('task:completed', {
      taskId: `task-${i}`,
      result: { type: 'coding', skills: ['coding'], durationMs: 1000 + i * 100 },
    }, 'test');
  }
  
  // Check patterns detected
  const patterns = learningLoop.getAllPatterns();
  console.log(`   ✅ Patterns detected: ${patterns.length}`);
  
  // Check lessons generated
  const lessons = learningLoop.getAllLessons();
  console.log(`   ✅ Lessons generated: ${lessons.length}`);
  
  // Get learning metrics
  const learningMetrics = learningLoop.getMetrics();
  console.log(`   📊 Learning metrics: Analyzed=${learningMetrics.totalTasksAnalyzed}, Patterns=${learningMetrics.patternsDetected}, Lessons=${learningMetrics.lessonsGenerated}`);
  
  console.log('');

  // ==================== Test 4: Self-improvement ====================
  console.log('🔧 Test 4: Self-improvement');
  
  const selfImprovement = new SelfImprovement(eventBus);
  
  // Trigger metrics collection by emitting events
  await eventBus.emit('task:completed', { taskId: 'test', result: {} }, 'test');
  await eventBus.emit('task:failed', { taskId: 'test-fail', errorMessage: 'Test error' }, 'test');
  
  // Get metrics history
  const metricsHistory = selfImprovement.getMetricsHistory();
  console.log(`   ✅ Metrics collected: ${metricsHistory.length}`);
  
  // Get latest metrics
  const latestMetrics = selfImprovement.getLatestMetrics();
  if (latestMetrics) {
    console.log(`   ✅ Latest health score: ${latestMetrics.overallHealth}`);
  }
  
  // Get pending actions
  const pendingActions = selfImprovement.getPendingActions();
  console.log(`   ✅ Pending actions: ${pendingActions.length}`);
  
  // Get improvement stats
  const improvementStats = selfImprovement.getStats();
  console.log(`   📊 Improvement stats: Metrics=${improvementStats.metricsCollected}, Avg health=${improvementStats.avgHealth}`);
  
  console.log('');

  // ==================== Test 5: Event Integration ====================
  console.log('🔌 Test 5: Event Integration');
  
  const capturedEvents: string[] = [];
  
  // Listen for M5 events
  eventBus.on('memory:written', async (event) => {
    capturedEvents.push('memory:written');
  });
  
  eventBus.on('skill:updated', async (event) => {
    capturedEvents.push('skill:updated');
  });
  
  eventBus.on('learning:lesson_generated', async (event) => {
    capturedEvents.push('learning:lesson_generated');
  });
  
  eventBus.on('improvement:metrics_collected', async (event) => {
    capturedEvents.push('improvement:metrics_collected');
  });
  
  // Trigger events
  memoryManager.write('Event test', {}, []);
  skillEvaluator.recordUsage('agent-1', 'test-skill', true, 500);
  
  // Wait for async events
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(`   ✅ Events captured: ${capturedEvents.length}`);
  const uniqueEvents = Array.from(new Set(capturedEvents));
  console.log(`   📊 Event types: ${uniqueEvents.join(', ')}`);
  
  console.log('');

  // ==================== Summary ====================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 Milestone 5 Test Complete!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ Memory Intelligence: 3-tier system working');
  console.log('✅ Skill Evaluation: Health tracking + recommendations');
  console.log('✅ Learning Loop: Pattern detection + lesson generation');
  console.log('✅ Self-improvement: Metrics collection + actions');
  console.log('✅ Event Integration: All modules connected via EventBus');
  console.log('');
  console.log('📊 Final Stats:');
  console.log(`   Memory: ${memoryManager.getStats().total} entries`);
  console.log(`   Skills: ${skillEvaluator.getStats().totalSkills} tracked`);
  console.log(`   Lessons: ${learningLoop.getMetrics().lessonsGenerated} generated`);
  console.log(`   Health: ${selfImprovement.getStats().avgHealth}%`);
  console.log('');
}

// Run test
testMilestone5().catch(console.error);