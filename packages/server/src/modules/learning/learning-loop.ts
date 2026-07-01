// Learning Loop — Analyze tasks, extract patterns, generate lessons
import { EventBus, BaseEvent } from '../../event/bus';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface Lesson {
  id: string;
  title: string;
  description: string;
  pattern: string;
  category: LessonCategory;
  confidence: number;      // 0-1
  evidence: string[];      // task IDs that support this lesson
  createdAt: number;
  lastAppliedAt?: number;
  applicationCount: number;
}

export type LessonCategory = 
  | 'performance' 
  | 'reliability' 
  | 'resource' 
  | 'pattern' 
  | 'antipattern';

export interface TaskPattern {
  id: string;
  name: string;
  description: string;
  occurrences: number;
  taskIds: string[];
  metrics: PatternMetrics;
  detectedAt: number;
}

export interface PatternMetrics {
  avgDuration: number;
  successRate: number;
  commonSkills: string[];
  commonErrors: string[];
}

export interface LearningMetrics {
  totalTasksAnalyzed: number;
  patternsDetected: number;
  lessonsGenerated: number;
  lastAnalysisAt: number;
}

// ==================== Learning Loop ====================

export class LearningLoop {
  private lessons = new Map<string, Lesson>();
  private patterns = new Map<string, TaskPattern>();
  private eventBus: EventBus;
  private metrics: LearningMetrics;
  
  // Analysis thresholds
  private minPatternOccurrences = 3;
  private minLessonConfidence = 0.6;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.metrics = {
      totalTasksAnalyzed: 0,
      patternsDetected: 0,
      lessonsGenerated: 0,
      lastAnalysisAt: 0,
    };
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Analyze completed tasks
    this.eventBus.on('task:completed', async (event) => {
      await this.analyzeTask(event.payload as any);
    });

    // Analyze failed tasks for patterns
    this.eventBus.on('task:failed', async (event) => {
      await this.analyzeFailure(event.payload as any);
    });
  }

  // Analyze a completed task
  private async analyzeTask(taskData: {
    taskId: string;
    result: Record<string, unknown>;
  }): Promise<void> {
    this.metrics.totalTasksAnalyzed++;
    this.metrics.lastAnalysisAt = Date.now();

    // Extract task characteristics
    const characteristics = this.extractCharacteristics(taskData);
    
    // Check for patterns
    await this.detectPattern(characteristics, taskData.taskId);
    
    // Emit analysis event
    this.eventBus.emit('learning:analyzed', {
      taskId: taskData.taskId,
      characteristics,
      metrics: this.metrics,
    }, 'learning-loop').catch(() => {});
  }

  // Analyze a failed task
  private async analyzeFailure(taskData: {
    taskId: string;
    errorMessage: string;
  }): Promise<void> {
    this.metrics.totalTasksAnalyzed++;
    this.metrics.lastAnalysisAt = Date.now();

    // Extract error pattern
    const errorPattern = this.extractErrorPattern(taskData.errorMessage);
    
    // Check for recurring error patterns
    await this.detectErrorPattern(errorPattern, taskData.taskId);
    
    // Emit failure analysis event
    this.eventBus.emit('learning:failure_analyzed', {
      taskId: taskData.taskId,
      errorPattern,
      metrics: this.metrics,
    }, 'learning-loop').catch(() => {});
  }

  // Extract task characteristics for pattern matching
  private extractCharacteristics(taskData: {
    taskId: string;
    result: Record<string, unknown>;
  }): Record<string, unknown> {
    const result = taskData.result;
    
    return {
      type: (result as any)?.type || 'unknown',
      skills: (result as any)?.skills || [],
      duration: (result as any)?.durationMs || 0,
      hasOutput: !!(result as any)?.output,
      outputSize: JSON.stringify((result as any)?.output || {}).length,
    };
  }

  // Extract error pattern from error message
  private extractErrorPattern(errorMessage: string): string {
    // Normalize error message (remove specific IDs, paths, etc.)
    let pattern = errorMessage
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      .replace(/\/[^\s]+/g, '<PATH>')
      .replace(/\d+/g, '<NUM>')
      .toLowerCase();
    
    // Truncate to first 100 chars for pattern matching
    return pattern.substring(0, 100);
  }

  // Detect patterns in task characteristics
  private async detectPattern(
    characteristics: Record<string, unknown>,
    taskId: string
  ): Promise<void> {
    // Create pattern key from characteristics
    const patternKey = this.createPatternKey(characteristics);
    
    let pattern = this.patterns.get(patternKey);
    
    if (!pattern) {
      // Create new pattern
      pattern = {
        id: uuidv4(),
        name: this.generatePatternName(characteristics),
        description: this.generatePatternDescription(characteristics),
        occurrences: 0,
        taskIds: [],
        metrics: {
          avgDuration: 0,
          successRate: 0,
          commonSkills: [],
          commonErrors: [],
        },
        detectedAt: Date.now(),
      };
      this.patterns.set(patternKey, pattern);
    }

    // Update pattern
    pattern.occurrences++;
    pattern.taskIds.push(taskId);
    
    // Update metrics
    const duration = (characteristics as any).duration || 0;
    pattern.metrics.avgDuration = 
      (pattern.metrics.avgDuration * (pattern.occurrences - 1) + duration) / pattern.occurrences;
    
    const skills = (characteristics as any).skills || [];
    pattern.metrics.commonSkills = this.updateCommonItems(pattern.metrics.commonSkills, skills);

    // Check if pattern should generate a lesson
    if (pattern.occurrences >= this.minPatternOccurrences) {
      await this.generateLessonFromPattern(pattern);
    }

    this.metrics.patternsDetected = this.patterns.size;
  }

  // Detect error patterns
  private async detectErrorPattern(
    errorPattern: string,
    taskId: string
  ): Promise<void> {
    const patternKey = `error:${errorPattern}`;
    
    let pattern = this.patterns.get(patternKey);
    
    if (!pattern) {
      pattern = {
        id: uuidv4(),
        name: `Error Pattern: ${errorPattern.substring(0, 50)}`,
        description: `Recurring error: ${errorPattern}`,
        occurrences: 0,
        taskIds: [],
        metrics: {
          avgDuration: 0,
          successRate: 0,
          commonSkills: [],
          commonErrors: [errorPattern],
        },
        detectedAt: Date.now(),
      };
      this.patterns.set(patternKey, pattern);
    }

    pattern.occurrences++;
    pattern.taskIds.push(taskId);

    // Generate lesson for recurring errors
    if (pattern.occurrences >= this.minPatternOccurrences) {
      await this.generateErrorLesson(pattern, errorPattern);
    }
  }

  // Create a key for pattern matching
  private createPatternKey(characteristics: Record<string, unknown>): string {
    const type = (characteristics as any).type || 'unknown';
    const skills = ((characteristics as any).skills || []).sort().join(',');
    return `${type}:${skills}`;
  }

  // Generate pattern name from characteristics
  private generatePatternName(characteristics: Record<string, unknown>): string {
    const type = (characteristics as any).type || 'unknown';
    const skills = (characteristics as any).skills || [];
    
    if (skills.length > 0) {
      return `${type} tasks using ${skills.join(', ')}`;
    }
    return `${type} tasks`;
  }

  // Generate pattern description
  private generatePatternDescription(characteristics: Record<string, unknown>): string {
    const type = (characteristics as any).type || 'unknown';
    const skills = (characteristics as any).skills || [];
    const duration = (characteristics as any).duration || 0;
    
    let desc = `${type} task pattern`;
    if (skills.length > 0) {
      desc += ` using skills: ${skills.join(', ')}`;
    }
    if (duration > 0) {
      desc += ` with avg duration: ${duration}ms`;
    }
    return desc;
  }

  // Update common items list
  private updateCommonItems(current: string[], newItems: string[]): string[] {
    const combined = [...current, ...newItems];
    const counts = new Map<string, number>();
    
    for (const item of combined) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item]) => item);
  }

  // Generate lesson from a pattern
  private async generateLessonFromPattern(pattern: TaskPattern): Promise<void> {
    // Check if lesson already exists for this pattern
    const existingLesson = Array.from(this.lessons.values())
      .find(l => l.pattern === pattern.name);
    
    if (existingLesson) {
      // Update evidence
      const evidenceSet = new Set([...existingLesson.evidence, ...pattern.taskIds.slice(-5)]);
      existingLesson.evidence = Array.from(evidenceSet);
      existingLesson.confidence = Math.min(1.0, existingLesson.confidence + 0.1);
      existingLesson.applicationCount++;
      return;
    }

    // Generate new lesson
    const lesson: Lesson = {
      id: uuidv4(),
      title: `Pattern: ${pattern.name}`,
      description: pattern.description,
      pattern: pattern.name,
      category: this.categorizePattern(pattern),
      confidence: this.calculatePatternConfidence(pattern),
      evidence: pattern.taskIds.slice(-5), // Last 5 tasks
      createdAt: Date.now(),
      applicationCount: 0,
    };

    if (lesson.confidence >= this.minLessonConfidence) {
      this.lessons.set(lesson.id, lesson);
      this.metrics.lessonsGenerated++;
      
      // Emit lesson generated event
      this.eventBus.emit('learning:lesson_generated', {
        lessonId: lesson.id,
        title: lesson.title,
        category: lesson.category,
        confidence: lesson.confidence,
      }, 'learning-loop').catch(() => {});
    }
  }

  // Generate lesson from error pattern
  private async generateErrorLesson(
    pattern: TaskPattern,
    errorPattern: string
  ): Promise<void> {
    const lesson: Lesson = {
      id: uuidv4(),
      title: `Recurring Error: ${errorPattern.substring(0, 50)}`,
      description: `This error has occurred ${pattern.occurrences} times`,
      pattern: pattern.name,
      category: 'reliability',
      confidence: Math.min(1.0, pattern.occurrences / 10), // Higher confidence with more occurrences
      evidence: pattern.taskIds.slice(-5),
      createdAt: Date.now(),
      applicationCount: 0,
    };

    this.lessons.set(lesson.id, lesson);
    this.metrics.lessonsGenerated++;
    
    // Emit error lesson event
    this.eventBus.emit('learning:error_lesson_generated', {
      lessonId: lesson.id,
      errorPattern,
      occurrences: pattern.occurrences,
    }, 'learning-loop').catch(() => {});
  }

  // Categorize a pattern
  private categorizePattern(pattern: TaskPattern): LessonCategory {
    if (pattern.metrics.commonErrors.length > 0) {
      return 'reliability';
    }
    if (pattern.metrics.avgDuration > 10000) { // > 10 seconds
      return 'performance';
    }
    if (pattern.metrics.commonSkills.length > 3) {
      return 'resource';
    }
    return 'pattern';
  }

  // Calculate pattern confidence
  private calculatePatternConfidence(pattern: TaskPattern): number {
    const occurrenceScore = Math.min(1.0, pattern.occurrences / 10);
    const successRate = pattern.metrics.successRate;
    
    return (occurrenceScore * 0.6) + (successRate * 0.4);
  }

  // Get lesson
  getLesson(lessonId: string): Lesson | undefined {
    return this.lessons.get(lessonId);
  }

  // Get all lessons
  getAllLessons(): Lesson[] {
    return Array.from(this.lessons.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  // Get lessons by category
  getLessonsByCategory(category: LessonCategory): Lesson[] {
    return Array.from(this.lessons.values())
      .filter(l => l.category === category)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // Get pattern
  getPattern(patternId: string): TaskPattern | undefined {
    return this.patterns.get(patternId);
  }

  // Get all patterns
  getAllPatterns(): TaskPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  // Get learning metrics
  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  // Apply a lesson (mark as applied)
  async applyLesson(lessonId: string): Promise<void> {
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      lesson.lastAppliedAt = Date.now();
      lesson.applicationCount++;
      
      // Emit lesson applied event
      this.eventBus.emit('learning:lesson_applied', {
        lessonId,
        title: lesson.title,
        applicationCount: lesson.applicationCount,
      }, 'learning-loop').catch(() => {});
    }
  }
}