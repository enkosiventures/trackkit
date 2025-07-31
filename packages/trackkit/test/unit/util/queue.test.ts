import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventQueue } from '../../../src/util/queue';
import { getPageContext } from '../../../src/providers/shared/browser';

const pageContext = getPageContext();

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
      const id1 = queue.enqueue('track', ['event1'], pageContext);
      const id2 = queue.enqueue('pageview', ['/page'], pageContext);
      
      expect(queue.size).toBe(2);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
    
    it('handles queue overflow', () => {
      const onOverflow = vi.fn();
      queue = new EventQueue({ ...config, onOverflow });
      
      queue.enqueue('track', ['event1'], pageContext);
      queue.enqueue('track', ['event2'], pageContext);
      queue.enqueue('track', ['event3'], pageContext);
      queue.enqueue('track', ['event4'], pageContext);
      
      expect(queue.size).toBe(3);
      expect(onOverflow).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ args: ['event1'] })
        ])
      );
    });
    
    it('drops events when paused', () => {
      queue.pause();
      const id = queue.enqueue('track', ['event'], pageContext);
      
      expect(id).toBeUndefined();
      expect(queue.size).toBe(0);
    });
  });
  
  describe('flush', () => {
    it('returns and clears all events', () => {
      queue.enqueue('track', ['event1'], pageContext);
      queue.enqueue('track', ['event2'], pageContext);
      
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
      queue.enqueue('track', ['keep'], pageContext);
      queue.enqueue('pageview', ['/remove'], pageContext);
      queue.enqueue('track', ['keep2'], pageContext);
      
      const removed = queue.remove(e => e.type === 'pageview');
      
      expect(removed).toHaveLength(1);
      expect(queue.size).toBe(2);
      expect(removed[0].type).toBe('pageview');
    });
  });
  
  describe('pause/resume', () => {
    it('pauses and resumes queueing', () => {
      queue.enqueue('track', ['before'], pageContext);
      queue.pause();
      queue.enqueue('track', ['during'], pageContext);
      queue.resume();
      queue.enqueue('track', ['after'], pageContext);
      
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
      
      queue.enqueue('track', ['event'], pageContext);
      const state2 = queue.getState();
      
      expect(state2.size).toBe(1);
      expect(state2.oldestEventAge).toBeGreaterThanOrEqual(0);
    });
  });
});