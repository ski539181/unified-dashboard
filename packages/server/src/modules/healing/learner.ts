// Learner — Tracks effectiveness of healing actions
import { EffectivenessRecord, RootCause, HealingLog } from './types';

export class Learner {
  private records: EffectivenessRecord[] = [];
  private maxRecords = 1000;

  // Record effectiveness after an action
  record(record: EffectivenessRecord): void {
    this.records.push(record);

    // Trim if too many
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  // Calculate effectiveness from before/after metrics
  calculateEffectiveness(
    before: Record<string, number>,
    after: Record<string, number>,
    actionName: string
  ): number {
    // Effectiveness = how much the problem improved
    // For most actions: reduction in problematic metrics is good

    let score = 0;
    let factors = 0;

    // Queue size reduction
    if (before.queueSize !== undefined && after.queueSize !== undefined) {
      const delta = before.queueSize - after.queueSize;
      score += delta > 0 ? Math.min(1.0, delta / Math.max(before.queueSize, 1)) : 0;
      factors++;
    }

    // Dead letter reduction
    if (before.deadLetterCount !== undefined && after.deadLetterCount !== undefined) {
      const delta = before.deadLetterCount - after.deadLetterCount;
      score += delta > 0 ? Math.min(1.0, delta / Math.max(before.deadLetterCount, 1)) : 0;
      factors++;
    }

    // Error agent reduction
    if (before.errorAgents !== undefined && after.errorAgents !== undefined) {
      const delta = before.errorAgents - after.errorAgents;
      score += delta > 0 ? Math.min(1.0, delta / Math.max(before.errorAgents, 1)) : 0;
      factors++;
    }

    // Idle agents increase (more available workers)
    if (before.idleAgents !== undefined && after.idleAgents !== undefined) {
      const delta = after.idleAgents - before.idleAgents;
      score += delta > 0 ? Math.min(1.0, delta / Math.max(before.totalAgents, 1)) : 0;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5; // Default 0.5 if no factors
  }

  // Get best action for a root cause based on historical effectiveness
  getBestAction(rootCause: RootCause): string | null {
    const relevant = this.records.filter(r => r.rootCause === rootCause && r.success);
    if (relevant.length === 0) return null;

    // Group by action and average effectiveness
    const actionScores = new Map<string, { total: number; count: number }>();
    for (const r of relevant) {
      const existing = actionScores.get(r.actionName) || { total: 0, count: 0 };
      existing.total += r.effectiveness;
      existing.count++;
      actionScores.set(r.actionName, existing);
    }

    // Find best
    let bestAction: string | null = null;
    let bestScore = -1;
    const entries = Array.from(actionScores.entries());
    for (const [action, stats] of entries) {
      const avg = stats.total / stats.count;
      if (avg > bestScore) {
        bestScore = avg;
        bestAction = action;
      }
    }

    return bestAction;
  }

  // Get effectiveness stats for an action
  getActionStats(actionName: string): {
    totalAttempts: number;
    successRate: number;
    avgEffectiveness: number;
  } {
    const records = this.records.filter(r => r.actionName === actionName);
    if (records.length === 0) {
      return { totalAttempts: 0, successRate: 0, avgEffectiveness: 0 };
    }

    const successes = records.filter(r => r.success);
    const effectivenessSum = records.reduce((sum, r) => sum + r.effectiveness, 0);

    return {
      totalAttempts: records.length,
      successRate: successes.length / records.length,
      avgEffectiveness: effectivenessSum / records.length,
    };
  }

  // Get all records
  getAllRecords(): EffectivenessRecord[] {
    return [...this.records];
  }

  // Get records for a specific root cause
  getRecordsByRootCause(rootCause: RootCause): EffectivenessRecord[] {
    return this.records.filter(r => r.rootCause === rootCause);
  }
}