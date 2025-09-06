import type { InitOptions, Props } from '../types';
import type { StatefulProvider } from '../providers/stateful-wrapper';
import { AnalyticsFacade } from './index';
import { ConsentCategory, ConsentStatus } from '../consent/types';

let instance: AnalyticsFacade | null = null;

// -- lifecycle --

function ensureInstance(): AnalyticsFacade {
  return (instance ??= new AnalyticsFacade());
}

export function init(opts: InitOptions = {}): AnalyticsFacade {
  const instance = ensureInstance();
  instance.init(opts);
  return instance;
}

export function destroy() {
  try { instance?.destroy(); } catch {}
  instance = null;
}

export function getInstance() { return instance; }   // keep if you already expose this
export function getFacade()   { return instance; }   // nullable on purpose

// -- events --
export function track(name: string, props?: Props, category?: ConsentCategory) {
  ensureInstance().track(name, props, category);
}

export function pageview(url?: string) {
  ensureInstance().pageview(url);
}

export function identify(userId: string | null) {
  ensureInstance().identify(userId);
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

export function hasQueuedEvents() {
  return instance?.hasQueuedEvents() ?? false;
}
export function waitForReady(opts?: { timeoutMs?: number; mode?: 'tracking' | 'provider' }) {
  return instance?.waitForReady(opts) ?? Promise.resolve();
}
export function flushIfReady() { return instance?.flushIfReady() ?? false; }
export function getDiagnostics() { return instance?.getDiagnostics() ?? null; }

// -- test-only provider injection (works pre- and post-init) --

/** @internal test-only: inject provider pre/post init */
export function injectProviderForTests(provider: StatefulProvider) {
    ensureInstance().setProvider(provider);
}
