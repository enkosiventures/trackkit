import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionMonitor, type ConnectionState } from '../../../src/connection/monitor';

const setOnline = (flag: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { value: flag, configurable: true });

const fire = (name: 'online' | 'offline') =>
  window.dispatchEvent(new Event(name));

const tick = async () => {
  // Let any pending microtasks run; add a timer tick for good measure
  await Promise.resolve();
};

describe('ConnectionMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // default to online unless a test overrides
    setOnline(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits online/offline transitions and tracks slow state', () => {
    const states: ConnectionState[] = [];
    const m = new ConnectionMonitor({ slowThreshold: 100, checkInterval: 50 });
    m.subscribe(s => states.push(s));

    // go offline
    setOnline(false);
    fire('offline');
    expect(states.at(-1)).toBe('offline');

    // back online
    setOnline(true);
    fire('online');
    expect(states.at(-1)).toBe('online');

    // simulate slow: no successes for > slowThreshold * 2 (200ms)
    vi.advanceTimersByTime(250);
    expect(states.at(-1)).toBe('slow');

    // report success clears slow
    m.reportSuccess();
    expect(states.at(-1)).toBe('online');

    m.destroy();
  });

  it('reportFailure can mark offline for network errors', () => {
    const states: ConnectionState[] = [];
    const m = new ConnectionMonitor({ slowThreshold: 300, checkInterval: 30_000 });
    m.subscribe(s => states.push(s));

    m.reportFailure(new Error('Failed to fetch'));
    expect(states.at(-1)).toBe('offline');

    m.destroy();
  });

  it('initial state reflects navigator.onLine and interval/listeners are wired', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const setIntSpy = vi.spyOn(window, 'setInterval');

    setOnline(true);
    const m1 = new ConnectionMonitor({ slowThreshold: 1000, checkInterval: 5000 });
    expect(m1.getState()).toBe('online');
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(setIntSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    m1.destroy();

    setOnline(false);
    const m2 = new ConnectionMonitor({ slowThreshold: 1000, checkInterval: 5000 });
    expect(m2.getState()).toBe('offline');
    m2.destroy();
  });

  it('subscribe immediately emits current state and unsubscribe stops further emissions', () => {
    const m = new ConnectionMonitor({ checkInterval: 10_000 });
    const calls: ConnectionState[] = [];

    const unsub = m.subscribe((s) => calls.push(s));
    expect(calls).toEqual([m.getState()]); // immediate fire

    // state change after unsub should not call listener
    unsub();
    setOnline(false);
    fire('offline');
    expect(calls.length).toBe(1);

    m.destroy();
  });

  it('reportFailure prefers offline when navigator is offline; else slow after threshold', () => {
    const states: ConnectionState[] = [];
    const m = new ConnectionMonitor({ slowThreshold: 200, checkInterval: 60_000 });
    m.subscribe(s => states.push(s));

    // Offline short-circuit
    setOnline(false);
    m.reportFailure();
    expect(states.at(-1)).toBe('offline');

    // Back online; advance time beyond slowThreshold, then reportFailure
    setOnline(true);
    m.reportSuccess(); // reset timer
    vi.advanceTimersByTime(250);
    m.reportFailure();
    expect(states.at(-1)).toBe('slow');

    m.destroy();
  });

  it('interval checkSlow drives slow when elapsed > 2×slowThreshold while online', () => {
    const m = new ConnectionMonitor({ slowThreshold: 300, checkInterval: 100 });
    expect(m.getState()).toBe('online');

    // No successes for > 600ms
    vi.advanceTimersByTime(700);
    expect(m.getState()).toBe('slow');

    // Success should flip back to online
    m.reportSuccess();
    expect(m.getState()).toBe('online');

    m.destroy();
  });

  it('destroy removes listeners and clears interval', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const clearSpy = vi.spyOn(window, 'clearInterval');

    const m = new ConnectionMonitor({ slowThreshold: 500, checkInterval: 1000 });
    m.destroy();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(clearSpy).toHaveBeenCalledTimes(1);

    // advancing timers post-destroy should have no effect
    const stateBefore = m.getState();
    vi.advanceTimersByTime(10_000);
    await tick();
    expect(m.getState()).toBe(stateBefore);
  });
});
