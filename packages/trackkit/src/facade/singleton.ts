import type { InitOptions, Props } from '../types';
import type { StatefulProvider } from '../providers/stateful-wrapper';
import { AnalyticsFacade } from './index';
import { ConsentCategory, ConsentStatus } from '../consent/types';

let instance: AnalyticsFacade | null = null;

/** Calls made before init are kept here and replayed once init() runs */
type BufferedCall =
  | { type: 'track'; args: [name: string, props?: Props, category?: ConsentCategory] }
  | { type: 'pageview'; args: [url?: string] }
  | { type: 'identify'; args: [userId: string | null] };

let preInitBuffer: BufferedCall[] = [];

/** If a test injects a provider before init(), stash it here and apply after init() */
let pendingInjectedProvider: StatefulProvider | null = null;

// -- lifecycle --

export function init(opts: InitOptions = {}): AnalyticsFacade {
  if (!instance) instance = new AnalyticsFacade();
  if (pendingInjectedProvider) {
    instance.preInjectForTests?.(pendingInjectedProvider);
  }
  instance.init(opts);
  pendingInjectedProvider = null;

  // Drain any pre-init calls in order
  if (preInitBuffer.length) {
    for (const call of preInitBuffer) {
      switch (call.type) {
        case 'track':    instance.track(...call.args); break;
        case 'pageview': instance.pageview(...call.args); break;
        case 'identify': instance.identify(...call.args); break;
      }
    }
    preInitBuffer = [];
  }

  return instance;
}

export function destroy() {
  try { instance?.destroy(); } catch {}
  instance = null;
  preInitBuffer = [];
  pendingInjectedProvider = null;
}

export function getInstance() { return instance; }   // keep if you already expose this
export function getFacade()   { return instance; }   // nullable on purpose

// -- events --

export function track(name: string, props?: Props, category?: ConsentCategory) {
  if (instance) instance.track(name, props, category);
  else preInitBuffer.push({ type: 'track', args: [name, props ?? undefined, category] });
}

export function pageview(url?: string) {
  if (instance) instance.pageview(url);
  else preInitBuffer.push({ type: 'pageview', args: [url] });
}

export function identify(userId: string | null) {
  if (instance) instance.identify(userId);
  else preInitBuffer.push({ type: 'identify', args: [userId] });
}

// -- consent (facade is the single authority) --

export function getConsent(): ConsentStatus | 'unknown' {
  return instance?.getConsent() ?? 'unknown';
}
export function grantConsent() { instance?.grantConsent(); }
export function denyConsent()  { instance?.denyConsent(); }
export function resetConsent() { instance?.resetConsent(); }
export function setConsent(status: ConsentStatus) {
  switch (status) {
    case 'granted':  grantConsent(); break;
    case 'denied':   denyConsent();  break;
    case 'pending':  resetConsent(); break;
  }
}
// -- readiness / queue --

export function waitForReady(opts?: { timeoutMs?: number }) {
  return instance?.waitForReady(opts) ?? Promise.resolve();
}
export function hasQueuedEvents() {
  // Before init, reflect buffered calls
  return instance ? instance.hasQueuedEvents() : preInitBuffer.length > 0;
}
export function flushIfReady() { return instance?.flushIfReady() ?? false; }
export function getDiagnostics() { return instance?.getDiagnostics() ?? null; }

// -- test-only provider injection (works pre- and post-init) --

/** @internal test-only */
export function injectProviderForTests(p: StatefulProvider) {
  if (instance) {
    instance.setProvider(p);
  } else {
    pendingInjectedProvider = p;
  }
}
