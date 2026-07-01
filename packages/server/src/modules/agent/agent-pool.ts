// Agent System — Stateless agents with capabilities
import { v4 as uuidv4 } from 'uuid';
import { EventBus, BaseEvent } from '../../event/bus';
import { Task } from '../../modules/task/task-manager';

// Agent Types
export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  currentTaskId?: string;
  healthScore: number;
  lastHeartbeat: number;
  totalCompleted: number;
  totalFailed: number;
  createdAt: number;
}

export type AgentStatus = 
  | 'offline'
  | 'registering'
  | 'idle'
  | 'working'
  | 'paused'
  | 'completed'
  | 'error';

// Agent State Machine
export class AgentStateMachine {
  private transitions = new Map<AgentStatus, AgentStatus[]>([
    ['offline', ['registering']],
    ['registering', ['idle', 'offline']],
    ['idle', ['working', 'offline']],
    ['working', ['completed', 'error', 'paused']],
    ['paused', ['working', 'idle']],
    ['completed', ['idle']],
    ['error', ['idle', 'offline']],
  ]);

  canTransition(from: AgentStatus, to: AgentStatus): boolean {
    const allowed = this.transitions.get(from) || [];
    return allowed.includes(to);
  }

  transition(agent: Agent, to: AgentStatus): Agent {
    if (!this.canTransition(agent.status, to)) {
      throw new Error(`Invalid agent transition: ${agent.status} -> ${to}`);
    }

    const updated = { ...agent, status: to, lastHeartbeat: Date.now() };

    if (to === 'working') {
      // currentTaskId should be set by caller
    }
    if (to === 'completed' || to === 'idle') {
      updated.currentTaskId = undefined;
    }

    return updated;
  }
}

// Agent Executor Interface
export interface AgentExecutor {
  execute(task: Task, context: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// Mock Agent Executor (for testing)
export class MockAgentExecutor implements AgentExecutor {
  async execute(task: Task, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      taskId: task.id,
      result: `Mock completed: ${task.title}`,
      timestamp: Date.now(),
    };
  }
}

// Agent Pool
export class AgentPool {
  private agents = new Map<string, Agent>();
  private executors = new Map<string, AgentExecutor>();
  private stateMachine = new AgentStateMachine();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // Register agent
  async registerAgent(
    name: string,
    capabilities: string[],
    executor: AgentExecutor
  ): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name,
      capabilities,
      status: 'idle',
      healthScore: 100,
      lastHeartbeat: Date.now(),
      totalCompleted: 0,
      totalFailed: 0,
      createdAt: Date.now(),
    };

    this.agents.set(agent.id, agent);
    this.executors.set(agent.id, executor);

    await this.eventBus.emit('agent:registered', {
      agentId: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
    }, 'system');

    return agent;
  }

  // Get available agents for a task
  getAvailableAgents(requiredSkills: string[]): Agent[] {
    return Array.from(this.agents.values()).filter(agent => {
      // Must be idle
      if (agent.status !== 'idle') return false;
      
      // Must have required skills
      const hasAllSkills = requiredSkills.every(skill => 
        agent.capabilities.includes(skill)
      );
      
      return hasAllSkills;
    });
  }

  // Get agent
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  // Get all agents
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Assign task to agent
  async assignTask(agentId: string, taskId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const working = this.stateMachine.transition(agent, 'working');
    working.currentTaskId = taskId;
    this.agents.set(agentId, working);

    await this.eventBus.emit('agent:status_changed', {
      agentId,
      status: 'working',
      taskId,
    }, agentId);
  }

  // Execute task
  async executeTask(agentId: string, task: Task, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const executor = this.executors.get(agentId);
    if (!executor) {
      throw new Error(`No executor for agent: ${agentId}`);
    }

    try {
      const result = await executor.execute(task, context);
      
      // Mark agent as completed
      const agent = this.agents.get(agentId)!;
      const completed = this.stateMachine.transition(agent, 'completed');
      completed.totalCompleted += 1;
      this.agents.set(agentId, completed);

      await this.eventBus.emit('agent:status_changed', {
        agentId,
        status: 'completed',
      }, agentId);

      return result;
    } catch (error) {
      // Mark agent as error
      const agent = this.agents.get(agentId)!;
      const errorAgent = this.stateMachine.transition(agent, 'error');
      errorAgent.totalFailed += 1;
      this.agents.set(agentId, errorAgent);

      await this.eventBus.emit('agent:error', {
        agentId,
        error: (error as Error).message,
      }, agentId);

      throw error;
    }
  }

  // Get agent stats
  getStats(): {
    total: number;
    idle: number;
    working: number;
    error: number;
    offline: number;
  } {
    const agents = Array.from(this.agents.values());
    return {
      total: agents.length,
      idle: agents.filter(a => a.status === 'idle').length,
      working: agents.filter(a => a.status === 'working').length,
      error: agents.filter(a => a.status === 'error').length,
      offline: agents.filter(a => a.status === 'offline').length,
    };
  }
}
