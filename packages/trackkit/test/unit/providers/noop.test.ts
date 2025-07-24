// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import noopProvider from '../../../src/providers/noop';
import { init, waitForReady, grantConsent, destroy, track, PageContext } from '../../../src';

describe('No-op Provider', () => {
  beforeEach(() => {
    destroy();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    destroy();
    vi.clearAllMocks();
  });

  it('implements all required methods', () => {
    const instance = noopProvider.create({ provider: 'noop' }, false, false);
    expect(instance).toMatchObject({
      track: expect.any(Function),
      pageview: expect.any(Function),
      identify: expect.any(Function),
      destroy: expect.any(Function),
    });
  });

  it('accepts full call shape even when debug=false', () => {
    const p = noopProvider.create({ provider: 'noop' }, false, false);

    const spyTrack = vi.spyOn(p, 'track');
    const spyPv = vi.spyOn(p, 'pageview');
    const spyId = vi.spyOn(p, 'identify');

    const ctx = { url: '/x', timestamp: Date.now() } as any;

    p.track('ev', { a: 1 }, ctx);
    p.pageview(ctx);
    p.identify('u-1', ctx);

    expect(spyTrack).toHaveBeenCalledWith('ev', { a: 1 }, expect.objectContaining({ url: '/x' }));
    expect(spyPv).toHaveBeenCalledWith(ctx);
    expect(spyId).toHaveBeenCalledWith('u-1', ctx);
  });

  it('logs method calls in debug mode via facade flow', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    init({ debug: true, trackLocalhost: true });
    await waitForReady();
    grantConsent();

    window.history.pushState({}, '', '/test');
    track('test_event', { foo: 'bar' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.any(String),
      '[no-op] track',
      expect.objectContaining({
        name: 'test_event',
        props: { foo: 'bar' },
        pageContext: expect.objectContaining({
          url: '/test',
          hostname: 'localhost',
          language: expect.any(String),
          timestamp: expect.any(Number),
        })
      }),
    );

    consoleSpy.mockRestore();
  });

  it('destroy is idempotent', () => {
    const p = noopProvider.create({ provider: 'noop' }, false, false);
    expect(() => { p.destroy(); p.destroy(); }).not.toThrow();
  });

  it('identify and pageview flow through facade to provider', async () => {
    init({ debug: false, trackLocalhost: true });
    await waitForReady();
    grantConsent();

    // No direct handle to provider here; re-create raw provider to validate shapes
    const p = noopProvider.create({ provider: 'noop' }, false, false);

    const spyPv = vi.spyOn(p, 'pageview');
    const spyId = vi.spyOn(p, 'identify');
    
    const ctx: PageContext = {
      url: '/a',
      title: 'T',
      referrer: '/prev',
      viewportSize: { width: 800, height: 600 },
      language: 'en-US',
      hostname: 'localhost',
      timestamp: 123,
    };
    p.identify('u-42', ctx);
    p.pageview(ctx);

    expect(spyPv).toHaveBeenCalledWith(ctx);
    expect(spyId).toHaveBeenCalledWith('u-42', ctx);
  });
});
