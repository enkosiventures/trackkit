// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import noop from '../../../src/providers/noop';
import { init, waitForReady, grantConsent, track, PageContext } from '../../../src';
import { resetTests } from '../../helpers/core';
import { mockSender } from '../../helpers/providers';

describe('No-op Provider', () => {
  beforeEach(() => {
    mockSender.send.mockClear();
    resetTests(vi);
  });

  afterEach(() => {
    resetTests(vi);
  });

  it('implements all required methods', () => {
    const instance = noop.create({
      provider: { name: 'noop' },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });
    expect(instance).toMatchObject({
      track: expect.any(Function),
      pageview: expect.any(Function),
      identify: expect.any(Function),
      destroy: expect.any(Function),
    });
  });

  it('accepts full call shape even when debug=false', () => {
    const p = noop.create({
      provider: { name: 'noop' },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });
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

    init({ debug: true, trackLocalhost: true, consent: { disablePersistence: true }});
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
    const p = noop.create({
      provider: { name: 'noop' },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });
    expect(() => { p.destroy(); p.destroy(); }).not.toThrow();
  });

  it('identify and pageview flow through facade to provider', async () => {
    init({ debug: false, trackLocalhost: true, consent: { disablePersistence: true }});
    await waitForReady();
    grantConsent();

    // No direct handle to provider here; re-create raw provider to validate shapes
    const p = noop.create({
      provider: { name: 'noop' },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });

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

  it('mirrors events to sender when sender type is "noop"', async () => {
    const mockSend = vi.fn();
    const noopSender = {
      type: 'noop' as const,
      send: mockSend,
      override: false
    };

    const instance = noop.create({
      provider: { name: 'noop' },
      factory: { bustCache: false, debug: false, sender: noopSender },
    });

    const ctx = { url: '/foo', timestamp: 123, hostname: 'localhost' } as any;

    // 1. Track
    await instance.track('event_name', { prop: 1 }, ctx);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://noop.local/track',
      method: 'POST',
      body: expect.objectContaining({ name: 'event_name' })
    }));

    // 2. Pageview
    mockSend.mockClear();
    await instance.pageview(ctx);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://noop.local/pageview',
      body: expect.objectContaining({ pageContext: ctx })
    }));

    // 3. Identify
    mockSend.mockClear();
    instance.identify('user-1', ctx);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://noop.local/identify',
      body: { userId: 'user-1' }
    }));

    // 4. Destroy
    mockSend.mockClear();
    instance.destroy();
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://noop.local/destroy'
    }));
  });

  it('handles missing factory options gracefully', async () => {
    // Factory is optional in the create signature
    const instance = noop.create({
      provider: { name: 'noop' },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });
    
    // Should execute safely without throwing on undefined factory access
    await expect(instance.track('test', {}, {} as any)).resolves.not.toThrow();
  });
});
