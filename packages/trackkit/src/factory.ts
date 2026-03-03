import { AnalyticsFacade } from './facade/index';
import type { AnalyticsOptions, EventMap, AnyEventMap } from './types';

export function createAnalytics<E extends EventMap = AnyEventMap>(
  opts?: AnalyticsOptions,
): AnalyticsFacade<E> {
  const a = new AnalyticsFacade<E>();
  if (opts) a.init(opts);
  return a;
}
