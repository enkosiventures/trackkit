import type { InitOptions, Props } from '../types';
import type { StatefulProvider } from '../providers/stateful-wrapper';
import { AnalyticsFacade } from './index';
import type { ConsentCategory, ConsentStatus } from '../consent/types';
import { isServer } from '../util/env';
import { enqueueSSREvent } from '../queues';
import { DEFAULT_CATEGORY } from '../constants';

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
export function track(name: string, props?: Props, category: ConsentCategory = DEFAULT_CATEGORY) {
  if (isServer()) { 
    enqueueSSREvent('track', [name, props], category);
  } else {
    ensureInstance().track(name, props, category);
  }
}

export function pageview(url?: string) {
  if (isServer()) {
    enqueueSSREvent('pageview', url ? [url] : [], DEFAULT_CATEGORY);
  } else {
    ensureInstance().pageview(url);
  }
}

export function identify(userId: string | null) {
  if (isServer()) {
    enqueueSSREvent('identify', [userId], 'essential');
  } else {
    ensureInstance().identify(userId);
  }
}

// -- consent (facade is the single authority) --

export function getConsent(): ConsentStatus | 'unknown' {
  return ensureInstance().getConsent() ?? 'unknown';
}
export function grantConsent() { ensureInstance().grantConsent(); }
export function denyConsent()  { ensureInstance().denyConsent(); }
export function resetConsent() { ensureInstance().resetConsent(); }
export function setConsent(status: ConsentStatus) {
  switch (status) {
    case 'granted':  grantConsent(); break;
    case 'denied':   denyConsent();  break;
    case 'pending':  resetConsent(); break;
  }
}
// -- readiness / queue --

export function hasQueuedEvents() {
  return ensureInstance().hasQueuedEvents() ?? false;
}
export function waitForReady(opts?: { timeoutMs?: number; mode?: 'tracking' | 'provider' }) {
  const { mode = 'provider', timeoutMs } = opts ?? {};
  return ensureInstance().waitForReady({ mode, timeoutMs });
}
export async function flushIfReady(): Promise<number> {
  return ensureInstance().flushIfReady() ?? 0;
}
export function getDiagnostics() { return ensureInstance().getDiagnostics() ?? null; }

// -- test-only provider injection (works pre- and post-init) --

/** @internal test-only: inject provider pre/post init */
export function injectProviderForTests(provider: StatefulProvider) {
    ensureInstance().setProvider(provider);
}
