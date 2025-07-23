import { loadProvider } from '../providers/loader';
import { createLogger, setGlobalLogger } from '../util/logger';
import type { AnalyticsOptions } from '../types';
import type { StatefulProvider } from '../providers/stateful-wrapper';


export async function loadProviderAsync(
  config: AnalyticsOptions
): Promise<StatefulProvider> {
  // Set up logger
  setGlobalLogger(createLogger(!!config.debug));
  
  // Load provider
  const provider = await loadProvider(
    config.provider as any,
    config
  );
  
  return provider;
}