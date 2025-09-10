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
      const id1 = queue.enqueue('track', ['event1'], "analytics", pageContext);
      const id2 = queue.enqueue('pageview', ['/page'], "analytics", pageContext);

      expect(queue.size).toBe(2);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
    
    it('handles queue overflow', () => {
      const onOverflow = vi.fn();
      queue = new EventQueue({ ...config, onOverflow });
      
      queue.enqueue('track', ['event1'], "analytics", pageContext);
      queue.enqueue('track', ['event2'], "analytics", pageContext);
      queue.enqueue('track', ['event3'], "analytics", pageContext);
      queue.enqueue('track', ['event4'], "analytics", pageContext);
      
      expect(queue.size).toBe(3);
      expect(onOverflow).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ args: ['event1'] })
        ])
      );
    });

    it('drops the oldest items on overflow (FIFO) and reports all dropped', () => {
      const onOverflow = vi.fn();
      queue = new EventQueue({ ...config, maxSize: 3, onOverflow });

      queue.enqueue('track', ['e1'], 'analytics', pageContext);
      queue.enqueue('track', ['e2'], 'analytics', pageContext);
      queue.enqueue('track', ['e3'], 'analytics', pageContext);
      // Next enqueue causes 1 drop (keep last 3)
      queue.enqueue('track', ['e4'], 'analytics', pageContext);

      const events = queue.getEvents().map(e => e.args[0]);
      expect(events).toEqual(['e2', 'e3', 'e4']); // e1 dropped
      expect(onOverflow).toHaveBeenCalledTimes(1);
      const dropped = onOverflow.mock.calls[0][0];
      expect(dropped.map((d: any) => d.args[0])).toEqual(['e1']);
    });

    it('drops events when paused', () => {
      queue.pause();
      const id = queue.enqueue('track', ['event'], "analytics", pageContext);

      expect(id).toBeUndefined();
      expect(queue.size).toBe(0);
    });

    it('preserves consent category and pageContext on enqueue', () => {
      const ctx = { ...pageContext, url: '/ctx' };
      queue.enqueue('track', ['evt'], 'marketing', ctx as any);
      const [e] = queue.getEvents();

      expect(e.category).toBe('marketing');
      expect(e.pageContext?.url).toBe('/ctx');
    });

    it('stores a safe snapshot (later mutations do not affect queued payloads)', () => {
      const ctx = { url: '/start' };
      const props = { a: 1 };

      queue.enqueue('track', ['e', props], 'analytics', ctx);

      // mutate after enqueue
      ctx.url = '/mutated';
      (props as any).a = 999;

      const [event] = queue.flush();
      expect(event.pageContext?.url).toBe('/start');
      expect((event.args?.[1] as any).a).toBe(1);
    });
  });
  
  describe('flush', () => {
    it('returns and clears all events', () => {
      queue.enqueue('track', ['event1'], "analytics", pageContext);
      queue.enqueue('track', ['event2'], "analytics", pageContext);

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

    it('assigns timestamps; flushed events retain original order and increasing timestamps', () => {
      queue.enqueue('track', ['a'], 'analytics', pageContext);
      queue.enqueue('track', ['b'], 'analytics', pageContext);
      const flushed = queue.flush();

      expect(flushed).toHaveLength(2);
      expect(flushed[0].timestamp).toBeLessThanOrEqual(flushed[1].timestamp);
      expect(flushed.map(e => e.args[0])).toEqual(['a', 'b']);
    });

    it('retains only the newest maxSize items when overfilled; FIFO among retained', () => {

      queue.enqueue('track', ['e1'], 'analytics', pageContext);
      queue.enqueue('track', ['e2'], 'analytics', pageContext);
      queue.enqueue('track', ['e3'], 'analytics', pageContext);
      queue.enqueue('track', ['e4'], 'analytics', pageContext); // evicts e1

      const batch = queue.flush();
      expect(batch.map(e => e.args?.[0])).toEqual(['e2','e3','e4']);
    });

    it('flush() is idempotent and safe on empty', () => {
      expect(queue.flush()).toEqual([]);
      queue.enqueue('track', ['e'], 'analytics', pageContext);
      expect(queue.flush().length).toBe(1);
      expect(queue.flush().length).toBe(0);
    });
  });

  describe('clear', () => {
    it('clear() empties the queue', () => {
      queue.enqueue('track', ['a'], 'analytics', pageContext);
      queue.enqueue('pageview', ['/p'], 'analytics', pageContext);

      queue.clear();

      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
      expect(queue.getEvents()).toEqual([]);
    });
  });
  
  describe('remove', () => {
    it('removes events matching predicate', () => {
      queue.enqueue('track', ['keep'], "analytics", pageContext);
      queue.enqueue('pageview', ['/remove'], "analytics", pageContext);
      queue.enqueue('track', ['keep2'], "analytics", pageContext);

      const removed = queue.remove(e => e.type === 'pageview');
      
      expect(removed).toHaveLength(1);
      expect(queue.size).toBe(2);
      expect(removed[0].type).toBe('pageview');
    });

    it('remove() can remove multiple events when predicate matches several', () => {
      // Use a larger queue to avoid overflow affecting the assertion
      queue = new EventQueue({ ...config, maxSize: 10 });
      queue.enqueue('track', ['keep1'], 'analytics', pageContext);
      queue.enqueue('pageview', ['/rm1'], 'analytics', pageContext);
      queue.enqueue('pageview', ['/rm2'], 'analytics', pageContext);
      queue.enqueue('track', ['keep2'], 'analytics', pageContext);

      const removed = queue.remove(e => e.type === 'pageview');
      expect(removed).toHaveLength(2);
      expect(queue.size).toBe(2);
      expect(queue.getEvents().map(e => e.args[0])).toEqual(['keep1', 'keep2']);
    });
  });
  
  describe('pause/resume', () => {
    it('pauses and resumes queueing', () => {
      queue.enqueue('track', ['before'], "analytics", pageContext);
      queue.pause();
      queue.enqueue('track', ['during'], "analytics", pageContext);
      queue.resume();
      queue.enqueue('track', ['after'], "analytics", pageContext);

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
      
      queue.enqueue('track', ['event'], "analytics", pageContext);
      const state2 = queue.getState();
      
      expect(state2.size).toBe(1);
      expect(state2.oldestEventAge).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEvents', () => {
    it('getEvents() returns a copy; mutating it does not affect the queue', () => {
      queue.enqueue('track', ['x'], 'analytics', pageContext);

      const snap = queue.getEvents() as any[];
      expect(snap.length).toBe(1);

      snap.pop(); // mutate snapshot
      expect(snap.length).toBe(0);
      expect(queue.size).toBe(1); // queue unaffected
    });
  });

  describe('isEmpty', () => {
    it('isEmpty reflects enqueue/flush transitions', () => {
      expect(queue.isEmpty).toBe(true);
      queue.enqueue('track', ['a'], 'analytics', pageContext);
      expect(queue.isEmpty).toBe(false);
      queue.flush();
      expect(queue.isEmpty).toBe(true);
    });
  });
});