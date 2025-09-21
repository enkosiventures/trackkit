import type { ProviderType } from '../../types';
import { createGA4Client } from './client';
export type { GA4Options } from './types';
export default {
  create: createGA4Client,
  meta: {
    name: 'ga4' as ProviderType,
    version: '1.0.0',
  }
};