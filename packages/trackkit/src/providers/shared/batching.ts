// src/providers/shared/batching.ts

import { logger } from '../../util/logger';

/**
 * Event to be batched
 */
export interface BatchEvent<T = any> {
  id: string;
  timestamp: number;
  data: T;
  retries?: number;
}

/**
 * Batch configuration
 */
export interface BatchConfig {
  /**
   * Maximum number of events per batch
   */
  maxSize?: number;
  
  /**
   * Maximum time to wait before sending batch (ms)
   */
  maxWait?: number;
  
  /**
   * Maximum number of retries for failed batches
   */
  maxRetries?: number;
  
  /**
   * Retry delay multiplier (exponential backoff)
   */
  retryMultiplier?: number;
  
  /**
   * Function to send a batch
   */
  onFlush: (events: BatchEvent[]) => Promise<void>;
  
  /**
   * Function called on batch error
   */
  onError?: (error: Error, events: BatchEvent[]) => void;
}

/**
 * Event batcher for efficient network usage
 */
export class EventBatcher<T = any> {
  private config: Required<BatchConfig>;
  private queue: BatchEvent<T>[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isFlushing = false;
  private retryTimer?: NodeJS.Timeout;
  private eventCounter = 0;
  
  constructor(config: BatchConfig) {
    this.config = {
      maxSize: 10,
      maxWait: 5000,
      maxRetries: 3,
      retryMultiplier: 2,
      onError: () => {},
      ...config,
    };
  }
  
  /**
   * Add event to batch
   */
  add(data: T): string {
    const event: BatchEvent<T> = {
      id: this.generateId(),
      timestamp: Date.now(),
      data,
      retries: 0,
    };
    
    this.queue.push(event);
    logger.debug('Event added to batch', { 
      id: event.id, 
      queueSize: this.queue.length 
    });
    
    // Check if we should flush
    if (this.queue.length >= this.config.maxSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
    
    return event.id;
  }
  
  /**
   * Force flush the batch
   */
  async flush(): Promise<void> {
    // Cancel scheduled flush
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Don't flush if already flushing or queue is empty
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }
    
    this.isFlushing = true;
    const batch = [...this.queue];
    this.queue = [];
    
    try {
      logger.debug('Flushing batch', { size: batch.length });
      await this.config.onFlush(batch);
      logger.debug('Batch sent successfully');
    } catch (error) {
      logger.error('Batch send failed', error);
      
      // Handle retry logic
      const retriableBatch = batch.filter(
        event => (event.retries || 0) < this.config.maxRetries
      );
      
      if (retriableBatch.length > 0) {
        // Increment retry count and re-queue
        retriableBatch.forEach(event => {
          event.retries = (event.retries || 0) + 1;
        });
        
        // Add back to queue for retry
        this.queue.unshift(...retriableBatch);
        // @ts-expect-error 
        this.scheduleRetry(event?.retries || 1);
      }
      
      // Call error handler for events that won't be retried
      const failedEvents = batch.filter(
        event => (event.retries || 0) >= this.config.maxRetries
      );
      
      if (failedEvents.length > 0) {
        this.config.onError(
          error instanceof Error ? error : new Error(String(error)),
          failedEvents
        );
      }
    } finally {
      this.isFlushing = false;
    }
  }
  
  /**
   * Clear the batch queue
   */
  clear(): void {
    this.queue = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }
  
  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length;
  }
  
  /**
   * Destroy the batcher
   */
  destroy(): void {
    this.clear();
  }
  
  /**
   * Schedule a flush
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, this.config.maxWait);
  }
  
  /**
   * Schedule a retry with exponential backoff
   */
  private scheduleRetry(retryCount: number): void {
    if (this.retryTimer) return;
    
    const delay = Math.min(
      1000 * Math.pow(this.config.retryMultiplier, retryCount - 1),
      30000 // Max 30 seconds
    );
    
    logger.debug('Scheduling retry', { delay, retryCount });
    
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.flush();
    }, delay);
  }
  
  /**
   * Generate unique event ID
   */
  private generateId(): string {
    return `${Date.now()}_${++this.eventCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Rate limiter for preventing too many requests
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  
  constructor(maxTokens = 10, refillRate = 1) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  /**
   * Check if action is allowed
   */
  allow(tokens = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
  
  /**
   * Reset rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Debounce function for high-frequency events
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;
  
  return function debounced(...args: Parameters<T>): void {
    const later = () => {
      timeout = undefined;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for rate-limiting calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function throttled(...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}