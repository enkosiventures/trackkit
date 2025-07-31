
import { init } from '../../src';
import { StatefulProvider } from '../../src/providers/stateful-wrapper';
import { ProviderInstance } from '../../src/providers/types';
import type { AnalyticsOptions, PageContext } from '../../src/types'; // <-- adjust path

/** A provider that just records calls. Satisfies your ProviderInstance signature. */
// export class MockProvider implements ProviderInstance {
//   name = 'stub';
//   pageviewCalls: Array<{ url: string; pageContext?: PageContext }> = [];
//   eventCalls: Array<{ name: string; props?: Record<string, unknown>; url?: string; category?: string; pageContext?: PageContext }> = [];
//   identifyCalls: Array<string | null> = [];

//   // match your current ProviderInstance signatures:
//   pageview(url: string, pageContext?: PageContext): void {
//     this.pageviewCalls.push({ url, pageContext });
//   }

//   track(
//     name: string,
//     props?: Record<string, unknown>,
//     url?: string,
//     category?: string,
//     pageContext?: PageContext
//   ): void {
//     this.eventCalls.push({ name, props, url, category, pageContext });
//   }

//   identify(userId: string | null): void {
//     this.identifyCalls.push(userId);
//   }

//   destroy(): void {
//     // no-op
//   }
// }

export class MockProvider implements ProviderInstance {
  name = 'stub';
  pageviewCalls: Array<{ url: string; pageContext?: PageContext }> = [];
  eventCalls: Array<{ name: string; props?: Record<string, unknown>; url?: string; category?: string; pageContext?: PageContext }> = [];
  identifyCalls: Array<string | null> = [];
  private initPromise?: Promise<void>;

  // Add _init to simulate async initialization
  async _init(): Promise<void> {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  pageview(url: string, pageContext?: PageContext): void {
    this.pageviewCalls.push({ url, pageContext });
  }

  track(
    name: string,
    props?: Record<string, unknown>,
    url?: string,
    category?: string,
    pageContext?: PageContext
  ): void {
    this.eventCalls.push({ name, props, url, category, pageContext });
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
// export function createStatefulMock(opts: Partial<AnalyticsOptions> = {}) {
//   const provider = new MockProvider();

//   // Supply whatever options your StatefulProvider expects.
//   const defaultOptions = { onError: undefined } as unknown as AnalyticsOptions;
//   const stateful = new StatefulProvider(provider, { ...defaultOptions, ...opts });

//   return { stateful, provider };
// }
export async function createStatefulMock(opts: Partial<AnalyticsOptions> = {}) {
  const provider = new MockProvider();
  const defaultOptions = { onError: undefined } as unknown as AnalyticsOptions;
  const stateful = new StatefulProvider(provider, { ...defaultOptions, ...opts });
  
  // Initialize the stateful provider
  await stateful.init();
  
  return { stateful, provider };
}


export async function createFacade(opts: Partial<AnalyticsOptions> = {}, grantConstent = false) {
  const { stateful, provider } = await createStatefulMock(opts);

  const facade = await init({
    autoTrack: true,
    domains: ['localhost'],
    trackLocalhost: true,
    ...opts,
  });

  // Attach stub provider (adapt if your facade builds it internally)
  facade.setProvider(stateful);
  return { facade, provider };
}