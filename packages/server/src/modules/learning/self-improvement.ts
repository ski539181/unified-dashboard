// Self-improvement Logic — Update system metrics based on outcomes
import { EventBus, BaseEvent } from '../../event/bus';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface SystemMetrics {
  id: string;
  timestamp: number;
  taskMetrics: TaskMetrics;
  agentMetrics: AgentMetrics;
  memoryMetrics: MemoryMetrics;
  learningMetrics: LearningMetrics;
  overallHealth: number;  // 0-100
}

export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgDuration: number;
  successRate: number;
  retryRate: number;
}

export interface AgentMetrics {
  totalAgents: number;
  idleAgents: number;
  workingAgents: number;
  errorAgents: number;
  avgHealthScore: number;
}

export interface MemoryMetrics {
  workingMemorySize: number;
  longtermMemorySize: number;
  vectorMemorySize: number;
  compressionRate: number;
}

export interface LearningMetrics {
  patternsDetected: number;
  lessonsGenerated: number;
  lessonsApplied: number;
  overallLearningRate: number;
}

export interface ImprovementAction {
  id: string;
  type: ImprovementType;
  description: string;
  target: string;
  expectedImpact: number;  // 0-1
  executedAt?: number;
  result?: string;
}

export type ImprovementType = 
  | 'memory_compression'
  | 'agent_rebalance'
  | 'skill_optimization'
  | 'pattern_application'
  | 'metric_reset';

// ==================== Self-improvement Engine ====================

export class SelfImprovement {
  private metricsHistory: SystemMetrics[] = [];
  private pendingActions: ImprovementAction[] = [];
  private eventBus: EventBus;
  private maxHistorySize = 100;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Collect metrics on task completion
    this.eventBus.on('task:completed', async (event) => {
      await this.collectMetrics();
    });

    // Collect metrics on task failure
    this.eventBus.on('task:failed', async (event) => {
      await this.collectMetrics();
    });

    // Apply lessons when generated
    this.eventBus.on('learning:lesson_generated', async (event) => {
      const { lessonId, category } = event.payload as { lessonId: string; category: string };
      await this.generateImprovementAction(lessonId, category);
    });

    // Collect metrics on memory promotion
    this.eventBus.on('memory:promoted', async (event) => {
      await this.collectMetrics();
    });
  }

  // Collect current system metrics
  private async collectMetrics(): Promise<void> {
    const metrics: SystemMetrics = {
      id: uuidv4(),
      timestamp: Date.now(),
      taskMetrics: await this.collectTaskMetrics(),
      agentMetrics: await this.collectAgentMetrics(),
      memoryMetrics: await this.collectMemoryMetrics(),
      learningMetrics: await this.collectLearningMetrics(),
      overallHealth: 0,
    };

    // Calculate overall health
    metrics.overallHealth = this.calculateOverallHealth(metrics);

    // Add to history
    this.metricsHistory.push(metrics);
    
    // Trim history if too large
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }

    // Emit metrics collected event
    this.eventBus.emit('improvement:metrics_collected', {
      metricsId: metrics.id,
      overallHealth: metrics.overallHealth,
      timestamp: metrics.timestamp,
    }, 'self-improvement').catch(() => {});

    // Check if improvement actions needed
    await this.checkForImprovements(metrics);
  }

  // Collect task metrics (stub - would read from TaskManager in real impl)
  private async collectTaskMetrics(): Promise<TaskMetrics> {
    // In real implementation, this would query TaskManager
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgDuration: 0,
      successRate: 1.0,
      retryRate: 0,
    };
  }

  // Collect agent metrics (stub - would read from AgentPool in real impl)
  private async collectAgentMetrics(): Promise<AgentMetrics> {
    // In real implementation, this would query AgentPool
    return {
      totalAgents: 0,
      idleAgents: 0,
      workingAgents: 0,
      errorAgents: 0,
      avgHealthScore: 100,
    };
  }

  // Collect memory metrics (stub - would read from MemoryManager in real impl)
  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    // In real implementation, this would query MemoryManager
    return {
      workingMemorySize: 0,
      longtermMemorySize: 0,
      vectorMemorySize: 0,
      compressionRate: 0,
    };
  }

  // Collect learning metrics (stub - would read from LearningLoop in real impl)
  private async collectLearningMetrics(): Promise<LearningMetrics> {
    // In real implementation, this would query LearningLoop
    return {
      patternsDetected: 0,
      lessonsGenerated: 0,
      lessonsApplied: 0,
      overallLearningRate: 0,
    };
  }

  // Calculate overall health score (0-100)
  private calculateOverallHealth(metrics: SystemMetrics): number {
    const weights = {
      taskSuccess: 0.3,
      agentHealth: 0.3,
      memoryEfficiency: 0.2,
      learningRate: 0.2,
    };

    const taskScore = metrics.taskMetrics.successRate * 100;
    const agentScore = metrics.agentMetrics.avgHealthScore;
    const memoryScore = this.calculateMemoryScore(metrics.memoryMetrics);
    const learningScore = metrics.learningMetrics.overallLearningRate * 100;

    return Math.round(
      taskScore * weights.taskSuccess +
      agentScore * weights.agentHealth +
      memoryScore * weights.memoryEfficiency +
      learningScore * weights.learningRate
    );
  }

  // Calculate memory efficiency score
  private calculateMemoryScore(memory: MemoryMetrics): number {
    const totalMemory = memory.workingMemorySize + memory.longtermMemorySize + memory.vectorMemorySize;
    if (totalMemory === 0) return 100; // Empty is efficient
    
    // Score based on compression rate and distribution
    const workingRatio = memory.workingMemorySize / totalMemory;
    const compressionScore = memory.compressionRate * 100;
    
    // Good distribution: working < 20%, longterm > 50%
    const distributionScore = workingRatio < 0.2 ? 100 : (0.2 / workingRatio) * 100;
    
    return (compressionScore * 0.5) + (distributionScore * 0.5);
  }

  // Check for improvement opportunities
  private async checkForImprovements(metrics: SystemMetrics): Promise<void> {
    // High failure rate → memory compression
    if (metrics.taskMetrics.successRate < 0.8) {
      this.pendingActions.push({
        id: uuidv4(),
        type: 'memory_compression',
        description: 'Compress working memory to free resources',
        target: 'memory',
        expectedImpact: 0.2,
      });
    }

    // Many idle agents → rebalance
    if (metrics.agentMetrics.idleAgents > metrics.agentMetrics.workingAgents * 2) {
      this.pendingActions.push({
        id: uuidv4(),
        type: 'agent_rebalance',
        description: 'Rebalance agent workload',
        target: 'agents',
        expectedImpact: 0.3,
      });
    }

    // Low learning rate → apply patterns
    if (metrics.learningMetrics.overallLearningRate < 0.3) {
      this.pendingActions.push({
        id: uuidv4(),
        type: 'pattern_application',
        description: 'Apply learned patterns to improve performance',
        target: 'learning',
        expectedImpact: 0.4,
      });
    }

    // Execute pending actions
    await this.executePendingActions();
  }

  // Generate improvement action from lesson
  private async generateImprovementAction(
    lessonId: string,
    category: string
  ): Promise<void> {
    let actionType: ImprovementType;
    let description: string;

    switch (category) {
      case 'performance':
        actionType = 'skill_optimization';
        description = `Optimize skills based on lesson ${lessonId}`;
        break;
      case 'reliability':
        actionType = 'pattern_application';
        description = `Apply reliability pattern from lesson ${lessonId}`;
        break;
      case 'resource':
        actionType = 'memory_compression';
        description = `Compress memory based on resource lesson ${lessonId}`;
        break;
      default:
        actionType = 'pattern_application';
        description = `Apply pattern from lesson ${lessonId}`;
    }

    const action: ImprovementAction = {
      id: uuidv4(),
      type: actionType,
      description,
      target: category,
      expectedImpact: 0.3,
    };

    this.pendingActions.push(action);

    // Emit action generated event
    this.eventBus.emit('improvement:action_generated', {
      actionId: action.id,
      type: action.type,
      description: action.description,
    }, 'self-improvement').catch(() => {});
  }

  // Execute pending improvement actions
  private async executePendingActions(): Promise<void> {
    const actionsToExecute = [...this.pendingActions];
    this.pendingActions = [];

    for (const action of actionsToExecute) {
      try {
        await this.executeAction(action);
        action.executedAt = Date.now();
        action.result = 'success';
        
        // Emit action executed event
        this.eventBus.emit('improvement:action_executed', {
          actionId: action.id,
          type: action.type,
          result: 'success',
        }, 'self-improvement').catch(() => {});
      } catch (error) {
        action.result = `error: ${(error as Error).message}`;
        
        // Emit action failed event
        this.eventBus.emit('improvement:action_failed', {
          actionId: action.id,
          type: action.type,
          error: (error as Error).message,
        }, 'self-improvement').catch(() => {});
      }
    }
  }

  // Execute a single improvement action
  private async executeAction(action: ImprovementAction): Promise<void> {
    switch (action.type) {
      case 'memory_compression':
        // Emit compression request
        await this.eventBus.emit('memory:compress', {
          actionId: action.id,
        }, 'self-improvement');
        break;

      case 'agent_rebalance':
        // Emit rebalance request
        await this.eventBus.emit('agent:rebalance', {
          actionId: action.id,
        }, 'self-improvement');
        break;

      case 'skill_optimization':
        // Emit skill optimization request
        await this.eventBus.emit('skill:optimize', {
          actionId: action.id,
        }, 'self-improvement');
        break;

      case 'pattern_application':
        // Emit pattern application request
        await this.eventBus.emit('learning:apply_patterns', {
          actionId: action.id,
        }, 'self-improvement');
        break;

      case 'metric_reset':
        // Reset metrics history
        this.metricsHistory = [];
        break;
    }
  }

  // Get metrics history
  getMetricsHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }

  // Get latest metrics
  getLatestMetrics(): SystemMetrics | undefined {
    return this.metricsHistory[this.metricsHistory.length - 1];
  }

  // Get pending actions
  getPendingActions(): ImprovementAction[] {
    return [...this.pendingActions];
  }

  // Get improvement stats
  getStats(): {
    metricsCollected: number;
    pendingActions: number;
    executedActions: number;
    avgHealth: number;
  } {
    const executed = this.metricsHistory.length;
    const avgHealth = executed > 0
      ? this.metricsHistory.reduce((sum, m) => sum + m.overallHealth, 0) / executed
      : 0;

    return {
      metricsCollected: executed,
      pendingActions: this.pendingActions.length,
      executedActions: executed,
      avgHealth: Math.round(avgHealth),
    };
  }
}