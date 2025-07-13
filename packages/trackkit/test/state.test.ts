import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachine } from '../src/util/state';

describe('StateMachine', () => {
  let stateMachine: StateMachine;
  
  beforeEach(() => {
    stateMachine = new StateMachine();
  });
  
  describe('transitions', () => {
    it('starts in idle state', () => {
      expect(stateMachine.getState()).toBe('idle');
    });
    
    it('transitions from idle to initializing', () => {
      const result = stateMachine.transition('INIT');
      expect(result).toBe(true);
      expect(stateMachine.getState()).toBe('initializing');
    });
    
    it('transitions from initializing to ready', () => {
      stateMachine.transition('INIT');
      const result = stateMachine.transition('READY');
      expect(result).toBe(true);
      expect(stateMachine.getState()).toBe('ready');
    });
    
    it('handles error during initialization', () => {
      stateMachine.transition('INIT');
      const result = stateMachine.transition('ERROR');
      expect(result).toBe(true);
      expect(stateMachine.getState()).toBe('idle');
    });
    
    it('transitions to destroyed from any state', () => {
      stateMachine.transition('INIT');
      stateMachine.transition('READY');
      const result = stateMachine.transition('DESTROY');
      expect(result).toBe(true);
      expect(stateMachine.getState()).toBe('destroyed');
    });
    
    it('rejects invalid transitions', () => {
      const result = stateMachine.transition('READY'); // Can't go to ready from idle
      expect(result).toBe(false);
      expect(stateMachine.getState()).toBe('idle');
    });
    
    it('prevents transitions from destroyed state', () => {
      stateMachine.transition('DESTROY');
      const result = stateMachine.transition('INIT');
      expect(result).toBe(false);
      expect(stateMachine.getState()).toBe('destroyed');
    });
  });
  
  describe('subscribe', () => {
    it('notifies listeners on state change', () => {
      const listener = vi.fn();
      stateMachine.subscribe(listener);
      
      stateMachine.transition('INIT');
      
      expect(listener).toHaveBeenCalledWith(
        'initializing',
        'idle',
        'INIT'
      );
    });
    
    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = stateMachine.subscribe(listener);
      
      unsubscribe();
      stateMachine.transition('INIT');
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('handles errors in listeners', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      
      stateMachine.subscribe(errorListener);
      stateMachine.subscribe(goodListener);
      
      expect(() => stateMachine.transition('INIT')).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });
  });
  
  describe('waitForState', () => {
    it('resolves immediately if already in target state', async () => {
      await expect(stateMachine.waitForState('idle')).resolves.toBeUndefined();
    });
    
    it('waits for target state', async () => {
      const promise = stateMachine.waitForState('ready');
      
      stateMachine.transition('INIT');
      stateMachine.transition('READY');
      
      await expect(promise).resolves.toBeUndefined();
    });
    
    it('times out if state not reached', async () => {
      const promise = stateMachine.waitForState('ready', 100);
      
      await expect(promise).rejects.toThrow('Timeout waiting for state: ready');
    });
    
    it('rejects if destroyed while waiting', async () => {
      const promise = stateMachine.waitForState('ready');
      
      stateMachine.transition('DESTROY');
      
      await expect(promise).rejects.toThrow('Instance destroyed while waiting for state');
    });
  });
  
  describe('history', () => {
    it('tracks state history', () => {
      stateMachine.transition('INIT');
      stateMachine.transition('READY');
      
      const history = stateMachine.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        state: 'initializing',
        event: 'INIT',
      });
      expect(history[1]).toMatchObject({
        state: 'ready',
        event: 'READY',
      });
    });
  });
});