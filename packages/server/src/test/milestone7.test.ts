// Milestone 7 Test — Self-Healing System with Control Layer
import { EventBus, EventStore } from '../event/bus';
import { TaskManager } from '../modules/task/task-manager';
import { AgentPool, MockAgentExecutor } from '../modules/agent/agent-pool';
import { Orchestrator } from '../modules/orchestrator/orchestrator';
import { SelfHealer, ControlLayer } from '../modules/healing';
import { Detector } from '../modules/healing/detector';
import { Diagnoser } from '../modules/healing/diagnoser';
import { Learner } from '../modules/healing/learner';
import {
  SystemMetrics,
  createAnomaly,
} from '../modules/healing/types';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function main() {
  console.log('🧪 Testing Milestone 7: Self-Healing with Control Layer\n');

  const eventStore = new EventStore();
  const eventBus = new EventBus(eventStore);
  const taskManager = new TaskManager(eventBus);
  const agentPool = new AgentPool(eventBus);
  const orchestrator = new Orchestrator(eventBus, taskManager, agentPool);

  await agentPool.registerAgent('TestAgent', ['general'], new MockAgentExecutor());

  // ==================== Test 1: Control Layer ====================
  console.log('🎛️ Test 1: Control Layer — Safe Mutations');

  const control = new ControlLayer(taskManager, agentPool, orchestrator, eventBus);

  // Create some dead letter tasks for testing
  for (let i = 0; i < 3; i++) {
    await taskManager.createTask(`Dead Letter ${i}`, 'desc', 5, ['general'], 'test');
    const tasks = taskManager.getAllTasks();
    const task = tasks[tasks.length - 1];
    await taskManager.failTask(task.id, 'test error');
    await taskManager.failTask(task.id, 'test error');
    await taskManager.failTask(task.id, 'test error');
  }

  const beforeClear = control.taskManager.getMetrics();
  assert('Dead letters exist before clear', beforeClear.deadLetterCount === 3, `count=${beforeClear.deadLetterCount}`);

  // Real mutation via ControlLayer
  const clearResult = await control.execute('clearDeadLetters', () =>
    control.taskManager.clearDeadLetters([
      { name: 'hasDeadLetters', check: (m) => m.deadLetterCount > 0, message: 'No dead letters' },
    ])
  );

  const afterClear = control.taskManager.getMetrics();
  assert('Clear result success', clearResult.success === true);
  assert('Dead letters removed', afterClear.deadLetterCount === 0, `count=${afterClear.deadLetterCount}`);
  assert('Rollback available', typeof clearResult.rollback === 'function');
  console.log('');

  // ==================== Test 2: Rollback ====================
  console.log('🔄 Test 2: Rollback — Undo Mutation');

  // Rollback the clear
  if (clearResult.rollback) {
    await clearResult.rollback();
  }
  const afterRollback = control.taskManager.getMetrics();
  assert('Rollback restored dead letters', afterRollback.deadLetterCount === 3, `count=${afterRollback.deadLetterCount}`);
  console.log('');

  // ==================== Test 3: Agent Restart via ControlLayer ====================
  console.log('🤖 Test 3: Agent Restart via ControlLayer');

  // Manually set agent to error state
  const agents = agentPool.getAllAgents();
  const agent = agents[0];
  const agentsMap = (agentPool as any).agents;
  const stateMachine = (agentPool as any).stateMachine;
  // Valid transition: idle -> working -> error
  const workingAgent = stateMachine.transition(agent, 'working');
  const errorAgent = stateMachine.transition(workingAgent, 'error');
  agentsMap.set(agent.id, errorAgent);

  const beforeRestart = control.agentPool.getMetrics();
  assert('Agent in error state', beforeRestart.errorAgents === 1);

  const restartResult = await control.execute('restartErrorAgents', () =>
    control.agentPool.restartErrorAgents([
      { name: 'hasErrorAgents', check: (m) => m.errorAgents > 0, message: 'No error agents' },
    ])
  );

  const afterRestart = control.agentPool.getMetrics();
  assert('Restart result success', restartResult.success === true);
  assert('Agent restarted to idle', afterRestart.errorAgents === 0 && afterRestart.idleAgents >= 1);
  console.log('');

  // ==================== Test 4: Safety Check Blocks Mutation ====================
  console.log('🛡️ Test 4: Safety Check — Blocks Invalid Mutation');

  const blockedResult = await control.execute('clearDeadLetters', () =>
    control.taskManager.clearDeadLetters([
      { name: 'alwaysFails', check: () => false, message: 'Safety check blocked' },
    ])
  );

  assert('Safety check blocked mutation', blockedResult.success === false);
  assert('Error message present', blockedResult.error?.includes('Safety check blocked'));
  console.log('');

  // ==================== Test 5: Detector ====================
  console.log('🔍 Test 5: Detector — Anomaly Detection');

  const detector = new Detector();
  const badMetrics: SystemMetrics = {
    timestamp: Date.now(),
    taskManager: { queueSize: 25, retryCount: 12, deadLetterCount: 6, avgLatency: 35000, totalCompleted: 10, totalFailed: 8 },
    agentPool: { totalAgents: 1, errorAgents: 1, idleAgents: 0, workingAgents: 0, errorRate: 0.44 },
    eventBus: { eventCount: 200 },
  };

  const anomalies = detector.detect(badMetrics);
  assert('Anomalies detected', anomalies.length >= 3, `found ${anomalies.length}`);
  console.log('');

  // ==================== Test 6: Diagnoser ====================
  console.log('🩺 Test 6: Diagnoser — Root Cause Analysis');

  const diagnoser = new Diagnoser();
  const queueAnomaly = anomalies.find(a => a.metric === 'queueSize')!;
  const diagnosis = diagnoser.diagnose(queueAnomaly, badMetrics);

  assert('Root cause identified', diagnosis.rootCause === 'queue_backlog');
  assert('Confidence > 0', diagnosis.confidence > 0);
  console.log('');

  // ==================== Test 7: Learner ====================
  console.log('📚 Test 7: Learner — Effectiveness Tracking');

  const learner = new Learner();
  learner.record({ actionName: 'clearDeadLetters', rootCause: 'queue_backlog', success: true, effectiveness: 0.8, timestamp: Date.now() });
  learner.record({ actionName: 'clearDeadLetters', rootCause: 'queue_backlog', success: true, effectiveness: 0.9, timestamp: Date.now() });

  const bestAction = learner.getBestAction('queue_backlog');
  assert('Learner recommends clearDeadLetters', bestAction === 'clearDeadLetters');
  console.log('');

  // ==================== Test 8: Self-Healer ====================
  console.log('🛡️ Test 8: Self-Healer — Start/Stop');

  const selfHealer = new SelfHealer(taskManager, agentPool, orchestrator, eventBus, { dryRun: true });

  const status = selfHealer.getStatus();
  assert('Initially not running', status.isRunning === false);
  assert('Dry-run mode on', status.dryRun === true);

  selfHealer.start(1000);
  await new Promise(r => setTimeout(r, 1200));

  selfHealer.stop();
  const statusStopped = selfHealer.getStatus();
  assert('Stopped after stop()', statusStopped.isRunning === false);
  console.log('');

  // ==================== Summary ====================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🎉 Milestone 7 Test Complete: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ ControlLayer: Safe mutations with rollback');
  console.log('✅ Safety checks: Block invalid mutations');
  console.log('✅ Rollback: Undo mutations');
  console.log('✅ Detector: Anomaly detection');
  console.log('✅ Diagnoser: Root cause analysis');
  console.log('✅ Learner: Effectiveness tracking');
  console.log('✅ SelfHealer: Start/stop, dry-run');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);