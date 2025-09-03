import type { FacadeOptions, InitOptions } from '../types';
import { AnalyticsFacade } from '../facade';
import { logger } from '../util/logger';

let _facade: AnalyticsFacade | null = null;

/** Create (or return existing) facade instance. */
export function bootstrapFacade(opts?: InitOptions): AnalyticsFacade {
  if (_facade) {
    logger.warn('Analytics already initialized');
    return _facade;
  }
  _facade = new AnalyticsFacade();
  _facade.init(opts);
  return _facade;
}

/** Get the live facade; throws if not initialized. */
export function getFacade(): AnalyticsFacade {
  if (!_facade) {
    throw new Error('Trackkit not initialized. Call init() first.');
  }
  return _facade;
}

/** Get the live facade if present; otherwise null. */
export function getFacadeOptional(): AnalyticsFacade | null {
  return _facade;
}

/** Has a facade been created? */
export function hasFacade(): boolean {
  return _facade != null;
}

/** Destroy facade and clear the singleton. */
export function destroyFacade(): void {
  if (_facade) {
    _facade.destroy();
    _facade = null;
  }
}
