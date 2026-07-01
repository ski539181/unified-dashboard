// Event Bus — In-process event system with optional persistence
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Event Types
export interface BaseEvent {
  id: string;
  type: string;
  version: number;
  timestamp: number;
  source: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

// Event Handler
export type EventHandler = (event: BaseEvent) => Promise<void>;

// Event Bus
export class EventBus {
  private emitter = new EventEmitter();
  private handlers = new Map<string, EventHandler[]>();
  private eventStore: EventStore | null = null;

  constructor(eventStore?: EventStore) {
    this.eventStore = eventStore || null;
    this.emitter.setMaxListeners(100);
  }

  // Subscribe to event type
  on(type: string, handler: EventHandler): void {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  // Emit event
  async emit(type: string, payload: Record<string, unknown>, source: string, correlationId?: string): Promise<BaseEvent> {
    const event: BaseEvent = {
      id: uuidv4(),
      type,
      version: 1,
      timestamp: Date.now(),
      source,
      correlationId,
      payload,
    };

    // Persist to event store (if available)
    if (this.eventStore) {
      await this.eventStore.append(event);
    }

    // Notify handlers
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Event handler error for ${type}:`, error);
      }
    }

    // Emit to EventEmitter (for WebSocket broadcasting)
    this.emitter.emit(type, event);

    return event;
  }

  // Get EventEmitter for WebSocket
  getEmitter(): EventEmitter {
    return this.emitter;
  }
}

// Event Store (append-only)
export class EventStore {
  private events: BaseEvent[] = [];
  private sequenceCounter = 0;

  async append(event: BaseEvent): Promise<void> {
    this.sequenceCounter++;
    this.events.push({ ...event, sequence: this.sequenceCounter } as any);
  }

  async query(filter: { type?: string; from?: number; to?: number; correlationId?: string }): Promise<BaseEvent[]> {
    let result = [...this.events];

    if (filter.type) {
      result = result.filter(e => e.type === filter.type);
    }
    if (filter.from) {
      result = result.filter(e => e.timestamp >= filter.from!);
    }
    if (filter.to) {
      result = result.filter(e => e.timestamp <= filter.to!);
    }
    if (filter.correlationId) {
      result = result.filter(e => e.correlationId === filter.correlationId);
    }

    return result;
  }

  async getSequence(): Promise<number> {
    return this.sequenceCounter;
  }
}
