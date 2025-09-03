import type { FacadeOptions } from '../types';
import {
  bootstrapFacade,
  getFacade,
  getFacadeOptional,
  destroyFacade,
} from './runtime';
import { logger } from '../util/logger';
import { ConsentCategory } from '../consent/types';

export function init(opts?: FacadeOptions) {
  return bootstrapFacade(opts);
}

export function destroy(): void {
  destroyFacade();
}

export function track(name: string, props?: Record<string, unknown>, url?: ConsentCategory): void {
  const f = getFacadeOptional();
  if (!f) {
    logger.warn('track() called before init; ignoring');
    return;
  }
  f.track(name, props, url);
}

export function pageview(url?: string): void {
  const f = getFacadeOptional();
  if (!f) {
    logger.warn('pageview() called before init; ignoring');
    return;
  }
  f.pageview(url);
}

export function identify(userId: string | null): void {
  const f = getFacadeOptional();
  if (!f) {
    logger.warn('identify() called before init; ignoring');
    return;
  }
  f.identify(userId);
}

export function waitForReady(): Promise<void> {
  return getFacade().waitForReady();
}

export function flushIfReady(): void {
  const f = getFacadeOptional();
  if (!f) return;
  f.flushIfReady();
}

export function hasQueuedEvents(): boolean {
  const f = getFacade();
  return f ? f.hasQueuedEvents() : false;
}

export function getDiagnostics() {
  const f = getFacadeOptional();
  return f ? f.getDiagnostics() : { initialized: false };
}

export function getInstance() {
  return getFacade();
}
