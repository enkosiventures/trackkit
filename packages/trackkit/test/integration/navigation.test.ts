import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFacade } from '../helpers/providers';
import { navigate } from '../helpers/navigation';
import { grantConsent, destroy } from '../../src';

describe('Integration: real history + sandbox', () => {
  beforeEach(() => {
    // reset URL to a known baseline before every test
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    destroy();
  });

  it('fires an initial pageview after consent with autoTrack', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
    });

    await facade.init?.();
    grantConsent();

    // initial route “/”
    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/']);
  });

  it('emits exactly once on pushState (no double-fire)', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
    });
    await facade.init?.();
    grantConsent();
    provider.pageviewCalls.length = 0;

    await navigate('/x');
    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/x']);

    // navigating to the same URL should not add another pageview
    await navigate('/x');
    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/x']);
  });

  it('handles popstate (back/forward)', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
    });
    await facade.init?.();
    grantConsent();

    // drop the initial “/”
    provider.pageviewCalls.length = 0;

    // /a then /b
    await navigate('/a');
    await navigate('/b');

    // back -> /a (manual popstate)
    await navigate('/a');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(r => setTimeout(r, 0));

    // forward -> /b (manual popstate)
    await navigate('/b');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise(r => setTimeout(r, 0));

    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/a', '/b', '/a', '/b']);
  });

  it('respects `exclude` patterns (no emission for excluded paths)', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
      exclude: ['/private/*', '/admin'],
    });

    await facade.init?.();
    grantConsent();
    provider.pageviewCalls.length = 0;

    await navigate('/private/area');
    await navigate('/admin');
    await navigate('/public');

    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/public']);
  });

  it('respects domain allowlist (no emission on non-matching host)', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['example.com'], // does not include localhost
    });
    await facade.init?.();
    grantConsent();

    provider.pageviewCalls.length = 0;

    await navigate('/somewhere');
    expect(provider.pageviewCalls.length).toBe(0);
  });

  it('includes hash in URL when `includeHash: true`', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
      includeHash: true,
    });
    await facade.init?.();
    grantConsent();

    provider.pageviewCalls.length = 0;

    // push a hash-only change
    window.location.hash = '#tab-2';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await new Promise(r => setTimeout(r, 0));

    expect(provider.pageviewCalls.map(c => c?.url)).toEqual(['/#tab-2']);
  });

  it('unsubscribes listeners on destroy()', async () => {
    const { facade, provider } = await createFacade({
      autoTrack: true,
      domains: ['localhost'],
    });
    await facade.init?.();
    grantConsent();

    provider.pageviewCalls.length = 0;

    destroy(); // should remove navigation listeners

    await navigate('/after-destroy');
    expect(provider.pageviewCalls.length).toBe(0);
  });
});
