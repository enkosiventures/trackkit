import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { AnalyticsOptions, denyConsent, grantConsent, init, waitForReady, destroy } from '../../src';
import { createFacade } from '../helpers/providers';


async function navigate(url: string) {
  window.history.pushState({}, '', url);
  await Promise.resolve(); // flush microtask from patched pushState
  window.dispatchEvent(new PopStateEvent('popstate')); // harmless if unused
}

describe('Facade autotrack with real history', () => {

  beforeEach(() => {
    // Clear any module cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(async () => {
    destroy();
    
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    vi.clearAllMocks();
  });
  it('sends initial pageview once', async () => {
    const { facade, provider } = await createFacade();

    grantConsent();

    expect(provider.pageviewCalls.length).toBe(1);
    expect(provider.pageviewCalls[0].url).toBe('/');
  });

  it('sends SPA navigations and dedupes repeats', async () => {
    const { facade, provider } = await createFacade();

    grantConsent();
    provider.pageviewCalls.length = 0;

    await navigate('/a');
    await navigate('/a'); // duplicate
    await navigate('/b?x=1#h');

    console.warn('Pageview calls:', provider.pageviewCalls);

    expect(provider.pageviewCalls.map(c => c.url)).toEqual(['/a', '/b?x=1#h']);
    expect(provider.pageviewCalls[0].pageContext?.referrer ?? '').toBe('');  // A referrer
    expect(provider.pageviewCalls[1].pageContext?.referrer ?? '').toBe('/a'); // B referrer
  });

  it('applies exclusions', async () => {
    const { facade, provider } = await createFacade({ exclude: ['/secret/alpha'] });

    grantConsent();
    provider.pageviewCalls.length = 0;

    await navigate('/secret/alpha'); // excluded
    await navigate('/public');

    expect(provider.pageviewCalls.map(c => c.url)).toEqual(['/public']);
  });

  it('gates by consent per policy', async () => {
    const { facade, provider } = await createFacade({});
    denyConsent();
    provider.pageviewCalls.length = 0;

    await navigate('/pre-consent');

    grantConsent();

    await navigate('/after-consent');

    // Common policy: drop pre-consent, send after grant
    expect(provider.pageviewCalls.map(c => c.url)).toEqual(['/after-consent']);
  });
});
