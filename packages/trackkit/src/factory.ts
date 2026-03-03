import { AnalyticsFacade } from './facade/index';
import type { AnalyticsOptions } from './types';

export function createAnalytics(opts?: AnalyticsOptions) {
  const a = new AnalyticsFacade();
  if (opts) a.init(opts);
  return a;
}
