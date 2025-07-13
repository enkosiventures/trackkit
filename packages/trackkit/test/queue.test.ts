import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventQueue } from '../src/util/queue';

describe('EventQueue', () => {
  let queue: EventQueue;
  const config = {
    maxSize: 3,
    debug: false,
  };
  
  beforeEach(() => {
    queue = new EventQueue(config);
  });
  
  describe('enqueue', () => {
    it('adds events to queue', () => {
      const id1 = queue.enqueue('track', ['event1']);
      const id2 = queue.enqueue('pageview', ['/page']);
      
      expect(queue.size).toBe(2);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
    
    it('handles queue overflow', () => {
      const onOverflow = vi.fn();
      queue = new EventQueue({ ...config, onOverflow });
      
      queue.enqueue('track', ['event1']);
      queue.enqueue('track', ['event2']);
      queue.enqueue('track', ['event3']);
      queue.enqueue('track', ['event4']); // Overflow
      
      expect(queue.size).toBe(3);
      expect(onOverflow).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ args: ['event1'] })
        ])
      );
    });
    
    it('drops events when paused', () => {
      queue.pause();
      const id = queue.enqueue('track', ['event']);
      
      expect(id).toBeUndefined();
      expect(queue.size).toBe(0);
    });
  });
  
  describe('flush', () => {
    it('returns and clears all events', () => {
      queue.enqueue('track', ['event1']);
      queue.enqueue('track', ['event2']);
      
      const events = queue.flush();
      
      expect(events).toHaveLength(2);
      expect(queue.size).toBe(0);
      expect(events[0].args).toEqual(['event1']);
      expect(events[1].args).toEqual(['event2']);
    });
    
    it('returns empty array when queue is empty', () => {
      const events = queue.flush();
      expect(events).toEqual([]);
    });
  });
  
  describe('remove', () => {
    it('removes events matching predicate', () => {
      queue.enqueue('track', ['keep']);
      queue.enqueue('pageview', ['/remove']);
      queue.enqueue('track', ['keep2']);
      
      const removed = queue.remove(e => e.type === 'pageview');
      
      expect(removed).toHaveLength(1);
      expect(queue.size).toBe(2);
      expect(removed[0].type).toBe('pageview');
    });
  });
  
  describe('pause/resume', () => {
    it('pauses and resumes queueing', () => {
      queue.enqueue('track', ['before']);
      queue.pause();
      queue.enqueue('track', ['during']);
      queue.resume();
      queue.enqueue('track', ['after']);
      
      expect(queue.size).toBe(2); // 'during' was dropped
      const events = queue.getEvents();
      expect(events[0].args).toEqual(['before']);
      expect(events[1].args).toEqual(['after']);
    });
  });
  
  describe('getState', () => {
    it('returns queue state information', () => {
      const state1 = queue.getState();
      expect(state1).toEqual({
        size: 0,
        isPaused: false,
        oldestEventAge: null,
      });
      
      queue.enqueue('track', ['event']);
      const state2 = queue.getState();
      
      expect(state2.size).toBe(1);
      expect(state2.oldestEventAge).toBeGreaterThanOrEqual(0);
    });
  });
});