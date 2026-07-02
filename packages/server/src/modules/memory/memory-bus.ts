// Memory Bus — Agent OS v6.1
import { MemoryEntry, MemoryVersion, MemoryStats } from './types';
import { VersionManager } from './version-manager';
import { LockManager } from './lock-manager';
import { TransactionLog } from './transaction-log';
import { ConsolidationEngine } from './consolidation-engine';

export interface MemoryBusConfig {
  maxWorkingSize?: number;
  maxEntryAge?: number;
  lockTimeout?: number;
  maxTransactionLog?: number;
}

export class MemoryBus {
  private workingMemory: Map<string, MemoryEntry> = new Map();
  private longTermMemory: Map<string, MemoryEntry> = new Map();
  private versionManager: VersionManager;
  private lockManager: LockManager;
  private transactionLog: TransactionLog;
  private consolidationEngine: ConsolidationEngine;
  private listeners: Map<string, ((entry: MemoryEntry) => void)[]> = new Map();

  constructor(config: MemoryBusConfig = {}) {
    this.lockManager = new LockManager();
    this.transactionLog = new TransactionLog(config.maxTransactionLog);
    this.consolidationEngine = new ConsolidationEngine(
      config.maxWorkingSize,
      config.maxEntryAge
    );
  }

  /**
   * Read memory entry
   */
  read(namespace: string, key: string, agentId: string): MemoryEntry | null {
    const fullKey = `${namespace}:${key}`;

    // Try working memory first (fastest)
    let entry = this.workingMemory.get(fullKey);
    if (entry) {
      this.updateAccess(entry);
      this.transactionLog.append({
        operation: 'read',
        namespace,
        key,
        value: entry.value,
        version: this.getVersion(entry.version),
        agentId,
        success: true,
      });
      return entry;
    }

    // Try long-term memory
    entry = this.longTermMemory.get(fullKey);
    if (entry) {
      // Cache in working memory
      this.workingMemory.set(fullKey, entry);
      this.updateAccess(entry);
      this.transactionLog.append({
        operation: 'read',
        namespace,
        key,
        value: entry.value,
        version: this.getVersion(entry.version),
        agentId,
        success: true,
      });
      return entry;
    }

    this.transactionLog.append({
      operation: 'read',
      namespace,
      key,
      version: VersionManager.initial(),
      agentId,
      success: true,
    });
    return null;
  }

  /**
   * Write memory entry (with versioning + lock)
   */
  write(
    namespace: string,
    key: string,
    value: unknown,
    agentId: string,
    tags: string[] = []
  ): { success: boolean; entry?: MemoryEntry; error?: string } {
    const fullKey = `${namespace}:${key}`;

    // Acquire write lock
    if (!this.lockManager.acquireWrite(namespace, agentId)) {
      this.transactionLog.append({
        operation: 'write',
        namespace,
        key,
        value,
        version: VersionManager.initial(),
        agentId,
        success: false,
        error: 'Failed to acquire write lock',
      });
      return { success: false, error: 'Failed to acquire write lock' };
    }

    try {
      const existing = this.workingMemory.get(fullKey) || this.longTermMemory.get(fullKey);
      const newVersion = existing
        ? VersionManager.increment(this.parseVersion(existing.version), 'patch')
        : VersionManager.initial();

      const now = Date.now();
      const entry: MemoryEntry = {
        id: existing?.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        namespace,
        key,
        value,
        version: VersionManager.serialize(newVersion),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        accessedAt: now,
        accessCount: (existing?.accessCount || 0) + 1,
        tags,
      };

      // Write to working memory
      this.workingMemory.set(fullKey, entry);

      // Log transaction
      this.transactionLog.append({
        operation: 'write',
        namespace,
        key,
        value,
        previousValue: existing?.value,
        version: newVersion,
        agentId,
        success: true,
      });

      // Emit event
      this.emit('memory:written', entry);

      // Check if consolidation needed
      if (this.consolidationEngine.needsConsolidation(this.workingMemory)) {
        this.consolidate();
      }

      return { success: true, entry };
    } catch (error) {
      this.transactionLog.append({
        operation: 'write',
        namespace,
        key,
        value,
        version: VersionManager.initial(),
        agentId,
        success: false,
        error: (error as Error).message,
      });
      return { success: false, error: (error as Error).message };
    } finally {
      // Always release lock
      this.lockManager.release(namespace);
    }
  }

  /**
   * Delete memory entry
   */
  delete(namespace: string, key: string, agentId: string): boolean {
    const fullKey = `${namespace}:${key}`;

    if (!this.lockManager.acquireWrite(namespace, agentId)) {
      return false;
    }

    try {
      const existing = this.workingMemory.get(fullKey) || this.longTermMemory.get(fullKey);
      if (!existing) return false;

      this.workingMemory.delete(fullKey);
      this.longTermMemory.delete(fullKey);

      this.transactionLog.append({
        operation: 'delete',
        namespace,
        key,
        previousValue: existing.value,
        version: this.getVersion(existing.version),
        agentId,
        success: true,
      });

      return true;
    } finally {
      this.lockManager.release(namespace);
    }
  }

  /**
   * Query memory by namespace
   */
  queryByNamespace(namespace: string, limit?: number): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    for (const entry of this.workingMemory.values()) {
      if (entry.namespace === namespace) {
        entries.push(entry);
      }
    }
    for (const entry of this.longTermMemory.values()) {
      if (entry.namespace === namespace && !entries.find((e) => e.key === entry.key)) {
        entries.push(entry);
      }
    }
    if (limit) entries.splice(limit);
    return entries;
  }

  /**
   * Query memory by tags
   */
  queryByTags(tags: string[], limit?: number): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    for (const entry of this.workingMemory.values()) {
      if (tags.some((t) => entry.tags.includes(t))) {
        entries.push(entry);
      }
    }
    for (const entry of this.longTermMemory.values()) {
      if (tags.some((t) => entry.tags.includes(t)) && !entries.find((e) => e.key === entry.key)) {
        entries.push(entry);
      }
    }
    if (limit) entries.splice(limit);
    return entries;
  }

  /**
   * Get version history
   */
  getVersionHistory(namespace: string, key: string): MemoryVersion[] {
    return this.transactionLog.getVersionHistory(namespace, key);
  }

  /**
   * Consolidate working memory to long-term
   */
  consolidate(): { consolidated: number; evicted: number } {
    const result = this.consolidationEngine.consolidate(
      this.workingMemory,
      this.longTermMemory
    );

    // Emit consolidation event (using a synthetic entry)
    this.emit('memory:consolidated', {
      id: `consolidated-${Date.now()}`,
      namespace: 'system',
      key: 'consolidation',
      value: result,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      tags: ['consolidation'],
    });

    return result;
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: (entry: MemoryEntry) => void): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
  }

  /**
   * Emit event
   */
  private emit(event: string, entry: MemoryEntry): void {
    const listeners = this.listeners.get(event) || [];
    for (const listener of listeners) {
      listener(entry);
    }
  }

  /**
   * Update access timestamp
   */
  private updateAccess(entry: MemoryEntry): void {
    entry.accessedAt = Date.now();
    entry.accessCount++;
  }

  /**
   * Parse version string
   */
  private parseVersion(version: string | number): MemoryVersion {
    if (typeof version === 'number') {
      return { major: version, minor: 0, patch: 0 };
    }
    return VersionManager.parse(version);
  }

  /**
   * Get version as MemoryVersion
   */
  private getVersion(version: string | number): MemoryVersion {
    return this.parseVersion(version);
  }

  /**
   * Get stats
   */
  getStats(): MemoryStats {
    const entries = [...this.workingMemory.values(), ...this.longTermMemory.values()];
    const byNamespace: Record<string, number> = {};

    for (const entry of entries) {
      byNamespace[entry.namespace] = (byNamespace[entry.namespace] || 0) + 1;
    }

    return {
      totalEntries: entries.length,
      totalSize: JSON.stringify(entries).length,
      byNamespace,
      oldestEntry: entries.reduce((min, e) => Math.min(min, e.createdAt), Infinity),
      newestEntry: entries.reduce((max, e) => Math.max(max, e.createdAt), 0),
      transactionCount: this.transactionLog.getStats().total,
    };
  }

  /**
   * Get transaction log stats
   */
  getTransactionStats(): ReturnType<TransactionLog['getStats']> {
    return this.transactionLog.getStats();
  }

  /**
   * Get lock stats
   */
  getLockStats(): ReturnType<LockManager['getStats']> {
    return this.lockManager.getStats();
  }
}
