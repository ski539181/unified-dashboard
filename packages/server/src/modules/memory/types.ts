// Memory System Types — Agent OS v6.1

export interface MemoryEntry {
  id: string;
  namespace: string;
  key: string;
  value: unknown;
  version: string; // "1.0.0" format
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  tags: string[];
}

export interface MemoryVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface TransactionRecord {
  id: string;
  operation: 'read' | 'write' | 'delete' | 'consolidate';
  namespace: string;
  key: string;
  value?: unknown;
  previousValue?: unknown;
  version: MemoryVersion;
  timestamp: number;
  agentId: string;
  success: boolean;
  error?: string;
}

export interface LockInfo {
  namespace: string;
  type: 'read' | 'write';
  agentId: string;
  acquiredAt: number;
  timeout: number;
}

export interface ConsolidationRule {
  sourceNamespace: string;
  targetNamespace: string;
  condition: (entries: MemoryEntry[]) => boolean;
  transform?: (entries: MemoryEntry[]) => MemoryEntry[];
}

export interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  byNamespace: Record<string, number>;
  oldestEntry: number;
  newestEntry: number;
  transactionCount: number;
}
