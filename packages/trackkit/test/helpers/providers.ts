
import { init } from '../../src';
import { ConsentCategory } from '../../src/consent/types';
import { DEFAULT_ERROR_HANDLER } from '../../src/constants';
import { StatefulProvider } from '../../src/providers/stateful-wrapper';
import type { ProviderInstance } from '../../src/types';
import type { InitOptions, PageContext } from '../../src/types';


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

  pageview(pageContext?: PageContext): void {
    console.warn('MockProvider pageview called with:', { pageContext });
    this.pageviewCalls.push(pageContext);
  }

  track(
    name: string,
    props?: Record<string, unknown>,
    pageContext?: PageContext
  ): void {
    console.warn('MockProvider track called with:', { name, props, pageContext });
    this.eventCalls.push({ name, props, pageContext });
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


export async function createFacade(opts: Partial<InitOptions> = {}) {
  const { stateful, provider } = await createStatefulMock();

  const facade = await init({
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