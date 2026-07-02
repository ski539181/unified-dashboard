// Consolidation Engine — Agent OS v6.1
import { MemoryEntry, ConsolidationRule } from './types';

export class ConsolidationEngine {
  private rules: ConsolidationRule[] = [];
  private readonly maxWorkingSize: number;
  private readonly maxEntryAge: number;

  constructor(maxWorkingSize: number = 1000, maxEntryAge: number = 24 * 60 * 60 * 1000) {
    this.maxWorkingSize = maxWorkingSize;
    this.maxEntryAge = maxEntryAge;
  }

  /**
   * Add consolidation rule
   */
  addRule(rule: ConsolidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Check if working memory needs consolidation
   */
  needsConsolidation(workingMemory: Map<string, MemoryEntry>): boolean {
    return workingMemory.size >= this.maxWorkingSize;
  }

  /**
   * Get LRU entries for eviction
   */
  getLRUEntries(workingMemory: Map<string, MemoryEntry>, count: number): MemoryEntry[] {
    const entries = Array.from(workingMemory.values());
    return entries
      .sort((a, b) => a.accessedAt - b.accessedAt)
      .slice(0, count);
  }

  /**
   * Get old entries for consolidation
   */
  getOldEntries(workingMemory: Map<string, MemoryEntry>): MemoryEntry[] {
    const cutoff = Date.now() - this.maxEntryAge;
    return Array.from(workingMemory.values()).filter((e) => e.updatedAt < cutoff);
  }

  /**
   * Consolidate entries based on rules
   */
  consolidate(
    source: Map<string, MemoryEntry>,
    target: Map<string, MemoryEntry>
  ): { consolidated: number; evicted: number } {
    let consolidated = 0;
    let evicted = 0;

    // Apply consolidation rules
    for (const rule of this.rules) {
      const sourceEntries = Array.from(source.values()).filter(
        (e) => e.namespace === rule.sourceNamespace
      );

      if (rule.condition(sourceEntries)) {
        const transformed = rule.transform ? rule.transform(sourceEntries) : sourceEntries;
        for (const entry of transformed) {
          const targetKey = `${entry.namespace}:${entry.key}`;
          target.set(targetKey, entry);
          source.delete(`${entry.namespace}:${entry.key}`);
          consolidated++;
        }
      }
    }

    // Evict LRU if still over limit
    if (source.size >= this.maxWorkingSize) {
      const toEvict = this.getLRUEntries(source, source.size - this.maxWorkingSize + 100);
      for (const entry of toEvict) {
        source.delete(`${entry.namespace}:${entry.key}`);
        evicted++;
      }
    }

    return { consolidated, evicted };
  }

  /**
   * Compress old entries (summarize)
   */
  compress(entries: MemoryEntry[]): MemoryEntry {
    // Simple compression: merge all values into one summary
    const summary = entries.map((e) => `[${e.key}]: ${JSON.stringify(e.value)}`).join('\n');

    return {
      id: `compressed-${Date.now()}`,
      namespace: entries[0]?.namespace || 'compressed',
      key: `compressed-${Date.now()}`,
      value: summary,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      tags: ['compressed'],
    };
  }

  /**
   * Get stats
   */
  getStats(): {
    rulesCount: number;
    maxWorkingSize: number;
    maxEntryAge: number;
  } {
    return {
      rulesCount: this.rules.length,
      maxWorkingSize: this.maxWorkingSize,
      maxEntryAge: this.maxEntryAge,
    };
  }
}
