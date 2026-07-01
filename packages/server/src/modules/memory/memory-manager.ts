// Memory Intelligence — 3-tier memory system (Event-driven)
// Working Memory (session) → Long-term Memory (EventStore) → Vector Memory (TF-IDF)
import { EventBus, BaseEvent } from '../../event/bus';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface MemoryEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  tier: MemoryTier;
  score: number;        // relevance/importance score (0-1)
  accessCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;   // for working memory TTL
  tags: string[];
}

export type MemoryTier = 'working' | 'longterm' | 'vector';

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;   // 0-1, for vector search
  score: number;        // combined relevance
}

// ==================== Working Memory ====================

class WorkingMemory {
  private entries = new Map<string, MemoryEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 3600000) { // 1 hour default
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  write(content: string, metadata: Record<string, unknown>, tags: string[] = []): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuidv4(),
      content,
      metadata,
      tier: 'working',
      score: 1.0,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      tags,
    };

    // Evict oldest if full
    if (this.entries.size >= this.maxSize) {
      const entries = Array.from(this.entries.values());
      const oldest = entries.sort((a, b) => a.updatedAt - b.updatedAt)[0];
      this.entries.delete(oldest.id);
    }

    this.entries.set(entry.id, entry);
    return entry;
  }

  read(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      // Check expiry
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.entries.delete(id);
        return undefined;
      }
      // Update access count
      entry.accessCount++;
      entry.updatedAt = Date.now();
    }
    return entry;
  }

  search(query: string): MemoryEntry[] {
    const now = Date.now();
    const lowerQuery = query.toLowerCase();
    const entries = Array.from(this.entries.values());
    return entries
      .filter(e => {
        if (e.expiresAt && now > e.expiresAt) return false;
        return e.content.toLowerCase().includes(lowerQuery) ||
               e.tags.some(t => t.toLowerCase().includes(lowerQuery));
      })
      .sort((a, b) => b.score - a.score);
  }

  compress(): MemoryEntry[] {
    const now = Date.now();
    const expired: MemoryEntry[] = [];
    const entries = Array.from(this.entries.entries());
    
    for (const [id, entry] of entries) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expired.push(entry);
        this.entries.delete(id);
      }
    }
    
    return expired; // Return expired for promotion to long-term
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  getSize(): number {
    return this.entries.size;
  }
}

// ==================== Long-term Memory ====================

class LongTermMemory {
  private entries = new Map<string, MemoryEntry>();
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  write(content: string, metadata: Record<string, unknown>, tags: string[] = []): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuidv4(),
      content,
      metadata,
      tier: 'longterm',
      score: 0.5, // Start with medium importance
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags,
    };

    // Evict lowest score if full
    if (this.entries.size >= this.maxEntries) {
      const entries = Array.from(this.entries.values());
      const lowest = entries.sort((a, b) => a.score - b.score)[0];
      this.entries.delete(lowest.id);
    }

    this.entries.set(entry.id, entry);
    return entry;
  }

  read(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.accessCount++;
      entry.updatedAt = Date.now();
      // Boost score on access
      entry.score = Math.min(1.0, entry.score + 0.05);
    }
    return entry;
  }

  search(query: string): MemoryEntry[] {
    const lowerQuery = query.toLowerCase();
    const entries = Array.from(this.entries.values());
    return entries
      .filter(e => 
        e.content.toLowerCase().includes(lowerQuery) ||
        e.tags.some(t => t.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.score - a.score);
  }

  updateScore(id: string, delta: number): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.score = Math.max(0, Math.min(1.0, entry.score + delta));
      entry.updatedAt = Date.now();
    }
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  getSize(): number {
    return this.entries.size;
  }
}

// ==================== Vector Memory (TF-IDF) ====================

class VectorMemory {
  private entries = new Map<string, MemoryEntry>();
  private idf = new Map<string, number>(); // term -> IDF score
  private maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  // Tokenize text into terms
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  // Calculate TF-IDF vector
  private tfidf(text: string): Map<string, number> {
    const terms = this.tokenize(text);
    const tf = new Map<string, number>();
    
    // Term frequency
    for (const term of terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }
    
    // TF-IDF
    const vector = new Map<string, number>();
    const entries = Array.from(tf.entries());
    for (const [term, count] of entries) {
      const tfScore = count / terms.length;
      const idfScore = this.idf.get(term) || 1.0;
      vector.set(term, tfScore * idfScore);
    }
    
    return vector;
  }

  // Cosine similarity between two vectors
  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    const aKeys = Array.from(a.keys());
    const bKeys = Array.from(b.keys());
    const allKeys = new Set([...aKeys, ...bKeys]);
    const terms = Array.from(allKeys);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (const term of terms) {
      const aVal = a.get(term) || 0;
      const bVal = b.get(term) || 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Update IDF based on new content
  updateIDF(text: string): void {
    const terms = this.tokenize(text);
    const uniqueTerms = Array.from(new Set(terms));
    for (const term of uniqueTerms) {
      this.idf.set(term, (this.idf.get(term) || 0) + 1);
    }
  }

  write(content: string, metadata: Record<string, unknown>, tags: string[] = []): MemoryEntry {
    this.updateIDF(content);
    
    const entry: MemoryEntry = {
      id: uuidv4(),
      content,
      metadata,
      tier: 'vector',
      score: 0.5,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags,
    };

    // Evict lowest score if full
    if (this.entries.size >= this.maxEntries) {
      const entries = Array.from(this.entries.values());
      const lowest = entries.sort((a, b) => a.score - b.score)[0];
      this.entries.delete(lowest.id);
    }

    this.entries.set(entry.id, entry);
    return entry;
  }

  search(query: string, topK = 5): MemorySearchResult[] {
    const queryVector = this.tfidf(query);
    const results: MemorySearchResult[] = [];
    const entries = Array.from(this.entries.values());
    
    for (const entry of entries) {
      const entryVector = this.tfidf(entry.content);
      const similarity = this.cosineSimilarity(queryVector, entryVector);
      
      results.push({
        entry,
        similarity,
        score: similarity * entry.score,
      });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  getSize(): number {
    return this.entries.size;
  }
}

// ==================== Memory Manager (Main) ====================

export class MemoryManager {
  private workingMemory: WorkingMemory;
  private longTermMemory: LongTermMemory;
  private vectorMemory: VectorMemory;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.workingMemory = new WorkingMemory();
    this.longTermMemory = new LongTermMemory();
    this.vectorMemory = new VectorMemory();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for task completion → store in working memory
    this.eventBus.on('task:completed', async (event) => {
      const { taskId, result } = event.payload;
      this.write(
        `Task ${taskId} completed: ${JSON.stringify(result)}`,
        { taskId, type: 'task_completion', result },
        ['task', 'completed']
      );
    });

    // Listen for task failure → store in working memory
    this.eventBus.on('task:failed', async (event) => {
      const { taskId, errorMessage } = event.payload;
      this.write(
        `Task ${taskId} failed: ${errorMessage}`,
        { taskId, type: 'task_failure', error: errorMessage },
        ['task', 'failed', 'error']
      );
    });

    // Listen for agent errors → store in long-term memory
    this.eventBus.on('agent:error', async (event) => {
      const { agentId, error } = event.payload;
      this.writeToTier(
        'longterm',
        `Agent ${agentId} error: ${error}`,
        { agentId, type: 'agent_error', error },
        ['agent', 'error']
      );
    });
  }

  // Write to working memory (default tier)
  write(content: string, metadata: Record<string, unknown>, tags: string[] = []): MemoryEntry {
    const entry = this.workingMemory.write(content, metadata, tags);
    
    // Emit memory write event (async, fire-and-forget)
    this.eventBus.emit('memory:written', {
      entryId: entry.id,
      tier: 'working',
      content: entry.content.substring(0, 100), // Truncate for event
    }, 'memory-manager').catch(() => {});
    
    return entry;
  }

  // Write to specific tier
  writeToTier(tier: MemoryTier, content: string, metadata: Record<string, unknown>, tags: string[] = []): MemoryEntry {
    let entry: MemoryEntry;
    
    switch (tier) {
      case 'working':
        entry = this.workingMemory.write(content, metadata, tags);
        break;
      case 'longterm':
        entry = this.longTermMemory.write(content, metadata, tags);
        break;
      case 'vector':
        entry = this.vectorMemory.write(content, metadata, tags);
        break;
      default:
        throw new Error(`Invalid tier: ${tier}`);
    }

    this.eventBus.emit('memory:written', {
      entryId: entry.id,
      tier,
      content: entry.content.substring(0, 100),
    }, 'memory-manager').catch(() => {});

    return entry;
  }

  // Read from working memory
  read(id: string): MemoryEntry | undefined {
    return this.workingMemory.read(id);
  }

  // Search across all tiers
  search(query: string, topK = 10): MemorySearchResult[] {
    const results: MemorySearchResult[] = [];
    
    // Search working memory
    const workingResults = this.workingMemory.search(query);
    for (const entry of workingResults) {
      results.push({ entry, similarity: 1.0, score: entry.score });
    }
    
    // Search long-term memory
    const longtermResults = this.longTermMemory.search(query);
    for (const entry of longtermResults) {
      results.push({ entry, similarity: 1.0, score: entry.score });
    }
    
    // Search vector memory
    const vectorResults = this.vectorMemory.search(query, topK);
    results.push(...vectorResults);
    
    // Sort by score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // Compress working memory → promote to long-term
  compress(): void {
    const expired = this.workingMemory.compress();
    
    for (const entry of expired) {
      // Promote to long-term if important enough
      if (entry.score > 0.3 || entry.accessCount > 2) {
        this.longTermMemory.write(
          entry.content,
          entry.metadata,
          entry.tags
        );
        
        // Also add to vector memory for semantic search
        this.vectorMemory.write(
          entry.content,
          entry.metadata,
          entry.tags
        );
        
        this.eventBus.emit('memory:promoted', {
          entryId: entry.id,
          fromTier: 'working',
          toTier: 'longterm',
        }, 'memory-manager').catch(() => {});
      }
    }
  }

  // Get stats
  getStats(): {
    working: number;
    longterm: number;
    vector: number;
    total: number;
  } {
    return {
      working: this.workingMemory.getSize(),
      longterm: this.longTermMemory.getSize(),
      vector: this.vectorMemory.getSize(),
      total: this.workingMemory.getSize() + this.longTermMemory.getSize() + this.vectorMemory.getSize(),
    };
  }
}