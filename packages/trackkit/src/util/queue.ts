/**
 * Event queue stub for Stage 1
 * Full implementation in Stage 3
 */

export interface QueuedEvent {
  type: 'track' | 'pageview' | 'identify';
  args: unknown[];
  timestamp: number;
}

/**
 * @internal
 */
export class EventQueue {
  private queue: QueuedEvent[] = [];
  
  enqueue(event: QueuedEvent): void {
    // Stub for Stage 1
  }
  
  flush(): QueuedEvent[] {
    // Stub for Stage 1
    return [];
  }
  
  clear(): void {
    this.queue = [];
  }
  
  get size(): number {
    return this.queue.length;
  }
}