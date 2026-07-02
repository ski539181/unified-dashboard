// Transaction Log — Agent OS v6.1
import { TransactionRecord, MemoryVersion } from './types';

export class TransactionLog {
  private log: TransactionRecord[] = [];
  private readonly maxLogSize: number;

  constructor(maxLogSize: number = 10000) {
    this.maxLogSize = maxLogSize;
  }

  /**
   * Append transaction to log
   */
  append(record: Omit<TransactionRecord, 'id' | 'timestamp'>): TransactionRecord {
    const entry: TransactionRecord = {
      ...record,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.log.push(entry);

    // Trim if exceeds max size
    if (this.log.length > this.maxLogSize) {
      this.log = this.log.slice(-this.maxLogSize);
    }

    return entry;
  }

  /**
   * Get transactions for a namespace
   */
  getByNamespace(namespace: string, limit?: number): TransactionRecord[] {
    const filtered = this.log.filter((r) => r.namespace === namespace);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get transactions for a key
   */
  getByKey(namespace: string, key: string, limit?: number): TransactionRecord[] {
    const filtered = this.log.filter((r) => r.namespace === namespace && r.key === key);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get transactions by agent
   */
  getByAgent(agentId: string, limit?: number): TransactionRecord[] {
    const filtered = this.log.filter((r) => r.agentId === agentId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get recent transactions
   */
  getRecent(limit: number = 100): TransactionRecord[] {
    return this.log.slice(-limit);
  }

  /**
   * Get failed transactions
   */
  getFailed(limit?: number): TransactionRecord[] {
    const failed = this.log.filter((r) => !r.success);
    return limit ? failed.slice(-limit) : failed;
  }

  /**
   * Get transactions in time range
   */
  getInRange(start: number, end: number): TransactionRecord[] {
    return this.log.filter((r) => r.timestamp >= start && r.timestamp <= end);
  }

  /**
   * Get version history for a key
   */
  getVersionHistory(namespace: string, key: string): MemoryVersion[] {
    return this.log
      .filter((r) => r.namespace === namespace && r.key === key && r.operation === 'write')
      .map((r) => r.version);
  }

  /**
   * Get stats
   */
  getStats(): {
    total: number;
    byOperation: Record<string, number>;
    successRate: number;
  } {
    const byOperation: Record<string, number> = {};
    let success = 0;

    for (const record of this.log) {
      byOperation[record.operation] = (byOperation[record.operation] || 0) + 1;
      if (record.success) success++;
    }

    return {
      total: this.log.length,
      byOperation,
      successRate: this.log.length > 0 ? success / this.log.length : 1,
    };
  }

  /**
   * Clear log
   */
  clear(): void {
    this.log = [];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
