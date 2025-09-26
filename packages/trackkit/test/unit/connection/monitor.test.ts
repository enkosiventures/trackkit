import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionMonitor } from '../../../src/connection/monitor';

const fire = (name: string) => window.dispatchEvent(new Event(name));

describe('ConnectionMonitor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits online/offline transitions and tracks slow state', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });

    const states: string[] = [];
    const m = new ConnectionMonitor({ slowThreshold: 100, checkInterval: 50 });
    m.subscribe(s => states.push(s));

    // go offline
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    fire('offline');
    expect(states.at(-1)).toBe('offline');

    // back online
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    fire('online');
    expect(states.at(-1)).toBe('online');

    // simulate slow: no successes for > slowThreshold * 2
    vi.advanceTimersByTime(250);
    expect(states.at(-1)).toBe('slow');

    // report success clears slow
    m.reportSuccess();
    expect(states.at(-1)).toBe('online');
  });

  it('reportFailure can mark offline for network errors', () => {
    const states: string[] = [];
    const m = new ConnectionMonitor();
    m.subscribe(s => states.push(s));

    m.reportFailure(new Error('Failed to fetch'));
    expect(states.at(-1)).toBe('offline');
  });
});
