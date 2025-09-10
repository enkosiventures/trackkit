/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { denyConsent, grantConsent, init, waitForReady, destroy } from '../../src';
import { createMockFacade } from '../helpers/providers';
import { navigate } from '../helpers/navigation';
import { tick } from '../helpers/core';

// @vitest-environment jsdom

// take function and run tick after it
const runWithTick = async (fn: () => void) => {
  fn();
  await tick();
};

const navigateWithTick = async (url: string) => {
  await navigate(url);
  await tick();
};

describe('Facade autotrack with real history', () => {

 beforeEach(() => {
   destroy();
 });

  afterEach(async () => {
    destroy();
    
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    vi.clearAllMocks();
  });
  it('sends initial pageview once', async () => {
    const { provider } = await createMockFacade();

    await runWithTick(grantConsent);

    expect(provider.pageviewCalls.length).toBe(1);
    expect(provider.pageviewCalls[0]?.url).toBe('/');
  });

  it('sends SPA navigations and dedupes repeats', async () => {
    const { provider } = await createMockFacade({ includeHash: true });

    await runWithTick(grantConsent);
    provider.pageviewCalls.length = 0;

    await navigateWithTick('/a');
    await navigateWithTick('/a'); // duplicate
    await navigateWithTick('/b?x=1#h');

    console.warn('Pageview calls:', provider.pageviewCalls);

    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/a', '/b?x=1#h']);
    expect(provider.pageviewCalls[0]?.referrer ?? '').toBe('/');  // A referrer
    expect(provider.pageviewCalls[1]?.referrer ?? '').toBe('/a'); // B referrer
  });

  it('applies exclusions', async () => {
    const { provider } = await createMockFacade({ exclude: ['/secret/alpha'] });

    await runWithTick(grantConsent);

    provider.pageviewCalls.length = 0;

    await navigateWithTick('/secret/alpha'); // excluded
    await navigateWithTick('/public');

    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/public']);
  });

  it('gates by consent per policy', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    init({ autoTrack: true, debug: true, trackLocalhost: true, consent: { requireExplicit: true }});
    await waitForReady();
    await new Promise(resolve => setTimeout(resolve, 50));
    denyConsent();

    await new Promise(resolve => setTimeout(resolve, 50));

    await navigate('/pre-consent');

    await new Promise(resolve => setTimeout(resolve, 50));

    grantConsent();

    await new Promise(resolve => setTimeout(resolve, 50));
    await navigate('/after-consent');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.any(String),
      '[no-op] pageview',
      expect.objectContaining({
        pageContext: {
          hostname: "localhost",
          language: "en-US",
          referrer: "/pre-consent",
          timestamp: expect.any(Number),
          url: "/after-consent",
          viewportSize: {
            height: 768,
            width: 1024,
          },
        },
      }),
    );
    consoleSpy.mockRestore();
  });
});
