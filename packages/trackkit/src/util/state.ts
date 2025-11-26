import type { ProviderState } from '../providers/types';
import { logger } from './logger';

export type ProviderStateHistory = Array<{ state: ProviderState; timestamp: number; event: StateEvent }>;

/**
 * State transition events
 */
export type StateEvent = 
  | 'INIT'
  | 'READY'
  | 'ERROR'
  | 'DESTROY';

/**
 * State change listener
 */
export type StateListener = (
  newState: ProviderState, 
  oldState: ProviderState,
  event: StateEvent
) => void;

/**
 * Valid state transitions
 */
const TRANSITIONS: Record<ProviderState, Partial<Record<StateEvent, ProviderState>>> = {
  idle: {
    INIT: 'initializing',
    DESTROY: 'destroyed',
  },
  initializing: {
    READY: 'ready',
    ERROR: 'idle',
    DESTROY: 'destroyed',
  },
  ready: {
    DESTROY: 'destroyed',
  },
  destroyed: {
    // Terminal state - no transitions
  },
  unknown: {
    // Allow any transition from unknown
    INIT: 'initializing',
    READY: 'ready',
    ERROR: 'idle',
    DESTROY: 'destroyed',
  }
};

/**
 * State machine for provider lifecycle
 */
export class StateMachine {
  private state: ProviderState = 'idle';
  private listeners: Set<StateListener> = new Set();
  private history: ProviderStateHistory = [];

  /**
   * Get current state
   */
  getState(): ProviderState {
    return this.state;
  }
  
  /**
   * Transition to new state
   */
  transition(event: StateEvent): boolean {
    const currentState = this.state;
    const nextState = TRANSITIONS[currentState]?.[event];
    
    if (!nextState) {
      logger.warn('Invalid state transition', { 
        from: currentState, 
        event,
        validEvents: Object.keys(TRANSITIONS[currentState] || {}),
      });
      return false;
    }
    
    this.state = nextState;
    this.history.push({
      state: nextState,
      timestamp: Date.now(),
      event,
    });
    
    logger.debug('State transition', {
      from: currentState,
      to: nextState,
      event,
    });
    
    // Notify listeners
    this.notifyListeners(nextState, currentState, event);
    
    return true;
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Wait for specific state
   */
  async waitForState(
    targetState: ProviderState, 
    timeoutMs = 5000
  ): Promise<void> {
    if (this.state === targetState) {
      return;
    }
    
    if (this.state === 'destroyed') {
      throw new Error('Cannot wait for state on destroyed instance');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for state: ${targetState}`));
      }, timeoutMs);
      
      const unsubscribe = this.subscribe((newState) => {
        if (newState === targetState) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        } else if (newState === 'destroyed') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error('Instance destroyed while waiting for state'));
        }
      });
    });
  }
  
  /**
   * Check if in terminal state
   */
  isTerminal(): boolean {
    return this.state === 'destroyed';
  }
  
  /**
   * Get state history for debugging
   */
  getHistory() {
    return [...this.history];
  }
  
  /**
   * Reset state machine
   */
  reset(): void {
    this.state = 'idle';
    this.listeners.clear();
    this.history = [];
  }
  
  private notifyListeners(
    newState: ProviderState, 
    oldState: ProviderState,
    event: StateEvent
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener(newState, oldState, event);
      } catch (error) {
        logger.error('Error in state listener', error);
      }
    });
  }
}