import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsFacade } from '../../../src/facade';
import { tick } from '../../helpers/core';
import { createFacade, createSpyProvider } from '../../helpers/providers';

// type SpyCall = { args: any[]; ctx?: any };
// function createSpyProvider() {
//   const pageviewCalls: SpyCall[] = [];
//   const eventCalls: SpyCall[] = [];
//   const identifyCalls: SpyCall[] = [];
//   const readyCallbacks: Array<() => void> = [];

//   const api = {
//     name: 'spy',
//     onReady(cb: () => void) { readyCallbacks.push(cb); cb(); },
//     getState() { return { provider: 'ready', history: [] as any[] }; },
//     pageview: (...args: any[]) => { pageviewCalls.push({ args }); },
//     track: (...args: any[]) => { eventCalls.push({ args }); },
//     identify: (...args: any[]) => { identifyCalls.push({ args }); },
//     destroy: () => {},
//     _get() { return { pageviewCalls, eventCalls, identifyCalls }; },
//   };
//   return api;
// }

// function makeFacade(base?: Partial<Parameters<AnalyticsFacade['init']>[0]>) {
//   const f = new AnalyticsFacade();
//   f.init({
//     debug: true,
//     domains: ['localhost'],
//     consent: { initialStatus: 'granted', disablePersistence: true },
//     ...base,
//   });
//   return f;
// }

describe('AnalyticsFacade policy gates', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '0', configurable: true });
    history.replaceState(null, '', '/');
  });

  it('respects DNT when doNotTrack=true (blocks sends, no queue)', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });

    const facade = createFacade({ doNotTrack: true });
    const spy = createSpyProvider();
    facade.setProvider(spy);

    facade.pageview();
    facade.track('ev', { a: 1 } as any);

    await tick(5);

    const calls = spy._get();
    expect(calls.pageviewCalls.length).toBe(0);
    expect(calls.eventCalls.length).toBe(0);
  });

  it('blocks when trackLocalhost=false on localhost', async () => {
    const facade = createFacade({ trackLocalhost: false, doNotTrack: false });
    const spy = createSpyProvider();
    facade.setProvider(spy);

    facade.pageview();
    facade.track('ev');

    await tick(5);
    const calls = spy._get();
    expect(calls.pageviewCalls.length).toBe(0);
    expect(calls.eventCalls.length).toBe(0);
  });

  it('domain allowlist blocks non-matching host', async () => {
    const facade = createFacade({ domains: ['example.com'], doNotTrack: false });
    const spy = createSpyProvider();
    facade.setProvider(spy);

    facade.pageview();
    await tick(5);
    expect(spy._get().pageviewCalls.length).toBe(0);
  });

  it('exclude patterns block pageview for matching path', async () => {
    history.replaceState(null, '', '/admin/panel');
    const facade = createFacade({ exclude: ['/admin/*'], doNotTrack: false, domains: ['localhost'] });
    const spy = createSpyProvider();
    facade.setProvider(spy);

    facade.pageview();
    await tick(5);
    expect(spy._get().pageviewCalls.length).toBe(0);
  });

  it('de-dupes consecutive identical pageviews', async () => {
    history.replaceState(null, '', '/same');
    const facade = createFacade({ doNotTrack: false, trackLocalhost: true, domains: ['localhost'] });
    const spy = createSpyProvider();
    facade.setProvider(spy);

    facade.pageview(); // send
    facade.pageview(); // duplicate → drop

    await tick(5);
    expect(spy._get().pageviewCalls.length).toBe(1);
  });

  it('allows essential category when consent denied and allowEssentialOnDenied=true', async () => {
    const facade = new AnalyticsFacade();
    facade.init({
      debug: true,
      domains: ['localhost'],
      consent: { initialStatus: 'denied', allowEssentialOnDenied: true, disablePersistence: true },
      trackLocalhost: true,
      doNotTrack: false,
    });
    const spy = createSpyProvider();
    facade.setProvider(spy);

    // Essential identify should pass, analytics track should be dropped
    facade.identify('u1');
    facade.track('blocked');

    await tick(5);
    const calls = spy._get();
    expect(calls.identifyCalls.length).toBe(1);
    expect(calls.eventCalls.length).toBe(0);
  });
});
