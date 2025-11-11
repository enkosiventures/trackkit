import { describe, it, expect, vi } from 'vitest';
import { StatefulProvider } from '../../../src/providers/stateful-wrapper';
import { AnalyticsError } from '../../../src/errors';
import { microtick } from '../../helpers/core';


function mkProvider(name = 'p') {
  return {
    name,
    track: vi.fn(),
    pageview: vi.fn(),
    identify: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('stateful-wrapper', () => {
  it('onReady fires immediately (microtask) when already ready; disposer is a no-op', async () => {
    const sp = new StatefulProvider(mkProvider());
    await sp.init(); // becomes ready
    const cb = vi.fn();
    const off = sp.onReady(cb);
    await microtick();
    expect(cb).toHaveBeenCalledTimes(1);
    off(); // no throw
  });

  it('onReady disposer removes pending callback', async () => {
    const sp = new StatefulProvider(mkProvider());
    const cb = vi.fn();
    const off = sp.onReady(cb);
    off();               // unsubscribe before ready
    await sp.init();     // ready now
    await microtick();
    expect(cb).not.toHaveBeenCalled();
  });

  it('destroy transitions and calls provider.destroy exactly once', () => {
    const p = mkProvider();
    const sp = new StatefulProvider(p);
    sp.destroy();
    sp.destroy(); // idempotent
    expect(p.destroy).toHaveBeenCalledTimes(1);
  });

  it('ERROR transition invokes onError with AnalyticsError(PROVIDER_ERROR)', () => {
    const onError = vi.fn();
    const sp = new StatefulProvider(mkProvider('bad'), onError);
    (sp as any).state.transition('INIT');
    (sp as any).state.transition('ERROR');
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as AnalyticsError;
    expect(err).toBeInstanceOf(AnalyticsError);
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.provider).toBe('bad');
  });

  it('getSnapshot returns state and history', async () => {
    const sp = new StatefulProvider(mkProvider());
    await sp.init();
    const snap = sp.getSnapshot();
    expect(snap.state).toBe(sp.getState());
    expect(Array.isArray(snap.history)).toBe(true);
  });
});
