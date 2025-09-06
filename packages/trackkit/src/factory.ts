import { AnalyticsFacade } from './facade/index';
import type { InitOptions } from './types';

export function createAnalytics(opts?: InitOptions) {
  const a = new AnalyticsFacade();
  if (opts) a.init(opts);
  return a;
}
