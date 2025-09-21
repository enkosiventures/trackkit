
import { createAnalytics, denyConsent, grantConsent, init } from '../../src';
import { ConsentCategory, ConsentStatus } from '../../src/consent/types';
import { DEFAULT_ERROR_HANDLER } from '../../src/constants';
import { AnalyticsFacade } from '../../src/facade';
import { injectProviderForTests, waitForReady } from '../../src/facade/singleton';
import { StatefulProvider } from '../../src/providers/stateful-wrapper';
import type { AnalyticsMode, ProviderInstance } from '../../src/types';
import type { InitOptions, PageContext } from '../../src/types';


const DEFAULT_ANALYTICS_MODE: AnalyticsMode = 'factory';

export class MockProvider implements ProviderInstance {
  name = 'mock';
  pageviewCalls: Array<PageContext | undefined> = [];
  eventCalls: Array<{ name: string; props?: Record<string, unknown>; url?: string; category?: ConsentCategory; pageContext?: PageContext }> = [];
  identifyCalls: Array<string | null> = [];

  // Add _init to simulate async initialization
  async _init(): Promise<void> {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  pageview(pageContext?: PageContext): Promise<void> {
    this.pageviewCalls.push(pageContext);
    return Promise.resolve();
  }

  track(
    name: string,
    props?: Record<string, unknown>,
    pageContext?: PageContext
  ): Promise<void> {
    this.eventCalls.push({ name, props, pageContext });
    return Promise.resolve();
  }

  identify(userId: string | null): void {
    this.identifyCalls.push(userId);
  }

  destroy(): void {
    // no-op
  }
}

/**
 * Build a real StatefulProvider that wraps our ProviderDouble.
 * Returns both so tests can assert on the double’s recorded calls.
 */
export async function createStatefulMock() {
  const provider = new MockProvider();
  const stateful = new StatefulProvider(provider, DEFAULT_ERROR_HANDLER);
  
  // Initialize the stateful provider
  await stateful.init();
  
  return { stateful, provider };
}

type SpyCall = { args: any[]; ctx?: any };
export function createSpyProvider() {
  const pageviewCalls: SpyCall[] = [];
  const eventCalls: SpyCall[] = [];
  const identifyCalls: SpyCall[] = [];
  const readyCallbacks: Array<() => void> = [];

  const api = {
    name: 'spy',
    onReady(cb: () => void) { readyCallbacks.push(cb); cb(); },
    getState() { return { provider: 'ready', history: [] as any[] }; },
    pageview: (...args: any[]) => { pageviewCalls.push({ args }); },
    track: (...args: any[]) => { eventCalls.push({ args }); },
    identify: (...args: any[]) => { identifyCalls.push({ args }); },
    destroy: () => {},
    ready: () => { readyCallbacks.forEach(cb => cb()); readyCallbacks.length = 0; },
    _get() { return { pageviewCalls, eventCalls, identifyCalls }; },
  };
  return api;
}

export function createFacade(base?: Partial<Parameters<AnalyticsFacade['init']>[0]>) {
  const f = new AnalyticsFacade();
  f.init({
    debug: true,
    domains: ['localhost'],
    consent: { initialStatus: 'granted', disablePersistence: true },
    ...base,
  });
  return f;
}

export async function createMockFacade(opts: Partial<InitOptions> = {}) {
  const { stateful, provider } = await createStatefulMock();

  const facade = init({
    autoTrack: true,
    domains: ['localhost'],
    trackLocalhost: true,
    consent: { disablePersistence: true },
    ...opts,
  });

  // Attach stub provider (adapt if your facade builds it internally)
  facade.setProvider(stateful);
  return { facade, provider };
}

export async function setupAnalytics(
  opts?: Partial<InitOptions>,
  config?: {
    mode?: AnalyticsMode;
    setConsent?: ConsentStatus;
    withMockProvider?: boolean;
  }
): Promise<{ facade?: AnalyticsFacade; provider?: MockProvider }> {
  let facade;
  let mockProvider;
  const mode = config?.mode ?? DEFAULT_ANALYTICS_MODE;
  const setConsent = config?.setConsent;
  const withMockProvider = config?.withMockProvider ?? true;
  const options = opts ? opts : {
    autoTrack: true,
    trackLocalhost: true,
    domains: ['localhost'],
    consent: { disablePersistence: true },
  };

  if (mode === 'factory') {
    facade = createAnalytics();
    if (withMockProvider) {
    const { stateful, provider } = await createStatefulMock();
      facade.setProvider(stateful);
      mockProvider = provider;
    }
    facade.init(options);

  } else {
    if (withMockProvider) {
      const { stateful, provider } = await createStatefulMock();
      injectProviderForTests(stateful);
      mockProvider = provider;
    }

    init(options);
  }

  if (setConsent === 'granted' || setConsent === 'denied') {
    setConsent === 'granted' ?
      mode === 'factory' ? facade!.grantConsent() : grantConsent() :
      mode === 'factory' ? facade!.denyConsent() : denyConsent();
    await (mode == 'factory' ? facade?.waitForReady() : waitForReady());
  }

  return { facade, provider: mockProvider };
}
