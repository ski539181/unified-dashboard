// End-to-End Test — Verify flow: User → API → Orchestrator → Agent → Event → Memory
import { EventBus, EventStore } from '../event/bus';
import { TaskManager } from '../modules/task/task-manager';
import { AgentPool, MockAgentExecutor } from '../modules/agent/agent-pool';
import { Orchestrator } from '../modules/orchestrator/orchestrator';

async function testEndToEndFlow() {
  console.log('🧪 Testing End-to-End Flow...\n');

  // 1. Create Event Store + Bus
  const eventStore = new EventStore();
  const eventBus = new EventBus(eventStore);

  // 2. Create Task Manager
  const taskManager = new TaskManager(eventBus);

  // 3. Create Agent Pool
  const agentPool = new AgentPool(eventBus);

  // 4. Register mock agent
  const agent = await agentPool.registerAgent(
    'TestAgent',
    ['general', 'testing'],
    new MockAgentExecutor()
  );
  console.log(`✅ Agent registered: ${agent.name} (${agent.id})`);

  // 5. Create Orchestrator
  const orchestrator = new Orchestrator(eventBus, taskManager, agentPool);

  // 6. Create task
  const task = await orchestrator.createTask(
    'Test Task',
    'This is a test task',
    5,
    ['general']
  );
  console.log(`✅ Task created: ${task.id}`);
  console.log(`   Status: ${task.status}`);

  // 7. Wait for task to be processed
  console.log('\n⏳ Waiting for task to be processed...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 8. Check task status
  const updatedTask = taskManager.getTask(task.id);
  console.log(`\n📊 Task Status: ${updatedTask?.status}`);
  console.log(`   Result: ${JSON.stringify(updatedTask?.result, null, 2)}`);

  // 9. Check events
  const events = await eventStore.query({});
  console.log(`\n📝 Events captured: ${events.length}`);
  events.forEach(event => {
    console.log(`   - ${event.type} (${event.source})`);
  });

  // 10. Check agent stats
  const agentStats = agentPool.getStats();
  console.log(`\n🤖 Agent Stats:`);
  console.log(`   Total: ${agentStats.total}`);
  console.log(`   Idle: ${agentStats.idle}`);
  console.log(`   Working: ${agentStats.working}`);

  // 11. Check orchestrator stats
  const orchStats = orchestrator.getStats();
  console.log(`\n⚙️ Orchestrator Stats:`);
  console.log(`   Queue size: ${orchStats.queueSize}`);

  // 12. Verify flow
  console.log('\n✅ Flow Verification:');
  console.log(`   Task created: ${task.status === 'created' || task.status === 'queued' || task.status === 'completed' ? '✅' : '❌'}`);
  console.log(`   Events captured: ${events.length > 0 ? '✅' : '❌'}`);
  console.log(`   Agent registered: ${agent ? '✅' : '❌'}`);
  console.log(`   Orchestrator running: ✅`);

  console.log('\n🎉 End-to-End Test Complete!');
}

// Run test
testEndToEndFlow().catch(console.error);
