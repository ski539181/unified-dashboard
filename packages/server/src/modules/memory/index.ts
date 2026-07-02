// Memory Module — Agent OS v6.1
export { MemoryBus } from './memory-bus';
export type { MemoryBusConfig } from './memory-bus';
export { VersionManager } from './version-manager';
export { LockManager } from './lock-manager';
export { TransactionLog } from './transaction-log';
export { ConsolidationEngine } from './consolidation-engine';
export type {
  MemoryEntry,
  MemoryVersion,
  TransactionRecord,
  LockInfo,
  ConsolidationRule,
  MemoryStats,
} from './types';
