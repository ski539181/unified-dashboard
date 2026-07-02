// Lock Manager — Agent OS v6.1
import { LockInfo } from './types';

export class LockManager {
  private locks: Map<string, LockInfo> = new Map();
  private readCounts: Map<string, number> = new Map();
  private readonly defaultTimeout = 30000; // 30s

  /**
   * Acquire read lock (multiple readers allowed)
   */
  acquireRead(namespace: string, agentId: string, timeout?: number): boolean {
    const existingLock = this.locks.get(namespace);
    
    // No lock exists or existing is read lock
    if (!existingLock || existingLock.type === 'read') {
      const lock: LockInfo = {
        namespace,
        type: 'read',
        agentId,
        acquiredAt: Date.now(),
        timeout: timeout || this.defaultTimeout,
      };
      this.locks.set(namespace, lock);
      this.readCounts.set(namespace, (this.readCounts.get(namespace) || 0) + 1);
      return true;
    }
    
    // Write lock exists — check timeout
    if (this.isLockExpired(existingLock)) {
      this.release(namespace);
      return this.acquireRead(namespace, agentId, timeout);
    }
    
    return false;
  }

  /**
   * Acquire write lock (exclusive access)
   */
  acquireWrite(namespace: string, agentId: string, timeout?: boolean): boolean {
    const existingLock = this.locks.get(namespace);
    
    // No lock exists
    if (!existingLock) {
      const lock: LockInfo = {
        namespace,
        type: 'write',
        agentId,
        acquiredAt: Date.now(),
        timeout: this.defaultTimeout,
      };
      this.locks.set(namespace, lock);
      return true;
    }
    
    // Check if expired
    if (this.isLockExpired(existingLock)) {
      this.release(namespace);
      return this.acquireWrite(namespace, agentId);
    }
    
    // Same agent re-acquiring (reentrant)
    if (existingLock.agentId === agentId) {
      return true;
    }
    
    return false;
  }

  /**
   * Release lock
   */
  release(namespace: string): void {
    const existingLock = this.locks.get(namespace);
    if (!existingLock) return;
    
    if (existingLock.type === 'read') {
      const count = (this.readCounts.get(namespace) || 1) - 1;
      if (count <= 0) {
        this.locks.delete(namespace);
        this.readCounts.delete(namespace);
      } else {
        this.readCounts.set(namespace, count);
      }
    } else {
      this.locks.delete(namespace);
    }
  }

  /**
   * Release all locks for an agent
   */
  releaseAll(agentId: string): void {
    for (const [namespace, lock] of this.locks.entries()) {
      if (lock.agentId === agentId) {
        this.release(namespace);
      }
    }
  }

  /**
   * Check if namespace is locked
   */
  isLocked(namespace: string): boolean {
    const lock = this.locks.get(namespace);
    if (!lock) return false;
    if (this.isLockExpired(lock)) {
      this.release(namespace);
      return false;
    }
    return true;
  }

  /**
   * Get lock info
   */
  getLock(namespace: string): LockInfo | undefined {
    return this.locks.get(namespace);
  }

  /**
   * Check if lock is expired
   */
  private isLockExpired(lock: LockInfo): boolean {
    return Date.now() - lock.acquiredAt > lock.timeout;
  }

  /**
   * Cleanup expired locks
   */
  cleanup(): number {
    let cleaned = 0;
    for (const [namespace, lock] of this.locks.entries()) {
      if (this.isLockExpired(lock)) {
        this.release(namespace);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Get stats
   */
  getStats(): { totalLocks: number; byType: { read: number; write: number } } {
    let read = 0;
    let write = 0;
    for (const lock of this.locks.values()) {
      if (lock.type === 'read') read++;
      else write++;
    }
    return { totalLocks: this.locks.size, byType: { read, write } };
  }
}
