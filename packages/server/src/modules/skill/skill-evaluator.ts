// Skill Evaluation System — Track skill usage + health score
import { EventBus, BaseEvent } from '../../event/bus';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface SkillRecord {
  id: string;
  name: string;
  agentId: string;
  usageCount: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  lastUsedAt: number;
  createdAt: number;
  healthScore: number;      // 0-100
  trend: SkillTrend;
}

export type SkillTrend = 'improving' | 'stable' | 'declining';

export interface SkillRecommendation {
  skill: string;
  agentId: string;
  reason: string;
  action: 'use_more' | 'use_less' | 'replace' | 'upgrade';
  confidence: number;       // 0-1
}

// ==================== Skill Evaluator ====================

export class SkillEvaluator {
  private skills = new Map<string, SkillRecord>(); // key: `${agentId}:${skillName}`
  private eventBus: EventBus;
  
  // Health score weights
  private weights = {
    successRate: 0.4,
    usageFrequency: 0.2,
    avgDuration: 0.2,
    recency: 0.2,
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Track task completion with skills
    this.eventBus.on('task:completed', async (event) => {
      const { taskId, result } = event.payload;
      // Extract agent and skills from task context
      const agentId = (result as any)?.agentId || 'unknown';
      const skills = (result as any)?.skills || [];
      
      for (const skill of skills) {
        this.recordUsage(agentId, skill, true, (result as any)?.durationMs || 1000);
      }
    });

    // Track task failure with skills
    this.eventBus.on('task:failed', async (event) => {
      const { taskId, errorMessage } = event.payload;
      const agentId = (event.payload as any)?.agentId || 'unknown';
      const skills = (event.payload as any)?.skills || [];
      
      for (const skill of skills) {
        this.recordUsage(agentId, skill, false, 0);
      }
    });
  }

  // Record skill usage
  recordUsage(agentId: string, skillName: string, success: boolean, durationMs: number): void {
    const key = `${agentId}:${skillName}`;
    let record = this.skills.get(key);
    
    if (!record) {
      record = {
        id: uuidv4(),
        name: skillName,
        agentId,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
        lastUsedAt: Date.now(),
        createdAt: Date.now(),
        healthScore: 50, // Start neutral
        trend: 'stable',
      };
      this.skills.set(key, record);
    }

    // Update counts
    record.usageCount++;
    if (success) {
      record.successCount++;
    } else {
      record.failureCount++;
    }
    record.totalDurationMs += durationMs;
    record.lastUsedAt = Date.now();

    // Recalculate health score
    const oldScore = record.healthScore;
    record.healthScore = this.calculateHealthScore(record);
    
    // Detect trend
    record.trend = this.detectTrend(oldScore, record.healthScore);

    // Emit skill update event
    this.eventBus.emit('skill:updated', {
      skill: skillName,
      agentId,
      healthScore: record.healthScore,
      trend: record.trend,
    }, 'skill-evaluator').catch(() => {});
  }

  // Calculate health score (0-100)
  private calculateHealthScore(record: SkillRecord): number {
    const successRate = record.usageCount > 0 
      ? (record.successCount / record.usageCount) * 100 
      : 50;

    // Usage frequency (normalized to 0-100, higher = more used)
    const usageScore = Math.min(100, record.usageCount * 10);

    // Average duration (lower is better, normalized)
    const avgDuration = record.usageCount > 0 
      ? record.totalDurationMs / record.usageCount 
      : 1000;
    const durationScore = Math.max(0, 100 - (avgDuration / 100)); // 100ms = 90, 1000ms = 90, etc.

    // Recency (decay over time)
    const hoursSinceUse = (Date.now() - record.lastUsedAt) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 100 - (hoursSinceUse * 2)); // Decays 2 points per hour

    // Weighted average
    const score = 
      successRate * this.weights.successRate +
      usageScore * this.weights.usageFrequency +
      durationScore * this.weights.avgDuration +
      recencyScore * this.weights.recency;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // Detect trend based on score change
  private detectTrend(oldScore: number, newScore: number): SkillTrend {
    const delta = newScore - oldScore;
    if (delta > 5) return 'improving';
    if (delta < -5) return 'declining';
    return 'stable';
  }

  // Get skill record
  getSkill(agentId: string, skillName: string): SkillRecord | undefined {
    return this.skills.get(`${agentId}:${skillName}`);
  }

  // Get all skills for an agent
  getAgentSkills(agentId: string): SkillRecord[] {
    const results: SkillRecord[] = [];
    const entries = Array.from(this.skills.entries());
    for (const [key, record] of entries) {
      if (key.startsWith(`${agentId}:`)) {
        results.push(record);
      }
    }
    return results.sort((a, b) => b.healthScore - a.healthScore);
  }

  // Get all skills
  getAllSkills(): SkillRecord[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.healthScore - a.healthScore);
  }

  // Detect unused/weak skills
  getWeakSkills(threshold = 30): SkillRecord[] {
    const allSkills = Array.from(this.skills.values());
    return allSkills
      .filter(s => s.healthScore < threshold)
      .sort((a, b) => a.healthScore - b.healthScore);
  }

  // Get unused skills (not used in last 7 days)
  getUnusedSkills(daysInactive = 7): SkillRecord[] {
    const cutoff = Date.now() - (daysInactive * 24 * 60 * 60 * 1000);
    const allSkills = Array.from(this.skills.values());
    return allSkills
      .filter(s => s.lastUsedAt < cutoff && s.usageCount > 0)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  }

  // Generate recommendations
  generateRecommendations(): SkillRecommendation[] {
    const recommendations: SkillRecommendation[] = [];
    const allSkills = Array.from(this.skills.values());

    for (const skill of allSkills) {
      // Low success rate → use_less or replace
      const successRate = skill.usageCount > 0 
        ? skill.successCount / skill.usageCount 
        : 0;
      
      if (successRate < 0.5 && skill.usageCount >= 5) {
        recommendations.push({
          skill: skill.name,
          agentId: skill.agentId,
          reason: `Low success rate: ${(successRate * 100).toFixed(1)}% (${skill.failureCount}/${skill.usageCount} failures)`,
          action: successRate < 0.3 ? 'replace' : 'use_less',
          confidence: 0.8,
        });
      }

      // Declining trend → investigate
      if (skill.trend === 'declining' && skill.usageCount >= 3) {
        recommendations.push({
          skill: skill.name,
          agentId: skill.agentId,
          reason: `Health score declining: ${skill.healthScore}`,
          action: 'upgrade',
          confidence: 0.6,
        });
      }

      // High success rate, low usage → use_more
      if (successRate > 0.9 && skill.usageCount < 5) {
        recommendations.push({
          skill: skill.name,
          agentId: skill.agentId,
          reason: `High success rate (${(successRate * 100).toFixed(1)}%) but low usage`,
          action: 'use_more',
          confidence: 0.7,
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  // Get stats
  getStats(): {
    totalSkills: number;
    avgHealthScore: number;
    weakSkills: number;
    unusedSkills: number;
    improving: number;
    declining: number;
  } {
    const allSkills = Array.from(this.skills.values());
    const totalHealth = allSkills.reduce((sum, s) => sum + s.healthScore, 0);
    
    return {
      totalSkills: allSkills.length,
      avgHealthScore: allSkills.length > 0 ? Math.round(totalHealth / allSkills.length) : 0,
      weakSkills: this.getWeakSkills().length,
      unusedSkills: this.getUnusedSkills().length,
      improving: allSkills.filter(s => s.trend === 'improving').length,
      declining: allSkills.filter(s => s.trend === 'declining').length,
    };
  }
}