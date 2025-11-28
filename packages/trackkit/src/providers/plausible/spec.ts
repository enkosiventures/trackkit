import type { PageContext } from '../../types';
import { createConfigProvider, type ProviderSpec } from '../base/adapter';
import type { PlausibleEventPayload, PlausibleOptions } from './types';

/**
 * Plausible spec.
 * Only: normalize options, provide endpoints, map payloads.
 * No policy (consent/DNT/localhost/exclusions) and no navigation logic here.
 */

function normalizeHost(host?: string): string {
  if (!host) return 'https://plausible.io';
  return host.replace(/\/+$/, '');
}

const plausibleSpec: ProviderSpec<PlausibleOptions> = {
  name: 'plausible',

  version: '1.0.0',

  defaults: (options: PlausibleOptions) => {
    const domain = options.domain?.trim();
    if (!domain) throw new Error('[plausible] "domain" is required');
    return {
      name: 'plausible',
      domain,
      host: normalizeHost(options.host),
      ...(options.revenue ? { revenue: options.revenue } : {}),
    };
  },

  endpoint: {
    pageview: (options) => ({ url: `${normalizeHost(options.host)}/api/event`, method: 'AUTO' }),
    event:    (options) => ({ url: `${normalizeHost(options.host)}/api/event`, method: 'AUTO' }),
  },

  headers: () => ({}),

  limits: { maxBeaconBytes: 64_000 },

  payload: {
    pageview: (pageContext: PageContext, options: PlausibleOptions): PlausibleEventPayload => {
      const body: PlausibleEventPayload = {
        name: 'pageview',
        url: pageContext.url,
        domain: options.domain,
        ...(pageContext.referrer ? { referrer: pageContext.referrer } : {}),
        ...(pageContext.title ? { props: { page_title: pageContext.title } } : {}),
      };
      return body;
    },

    event: (
      name: string,
      props: Record<string, unknown>,
      pageContext: PageContext,
      options: PlausibleOptions
    ): PlausibleEventPayload => {
      const body: PlausibleEventPayload = {
        name,
        url: pageContext.url,
        domain: options.domain,
        ...(pageContext.referrer ? { referrer: pageContext.referrer } : {}),
      };
      if (props && Object.keys(props).length > 0) body.props = props as Record<string, string | number>;
      if (options.revenue?.trackingEnabled && props.revenue && typeof props.revenue === 'object') {
        body.revenue = {
          // @ts-expect-error
          currency: props.revenue.currency ?? options.revenue.currency,
          // @ts-expect-error
          value: props.revenue.value ?? 0,
        };
        delete props.revenue;
      }
      return body;
    },
  },
};

export default createConfigProvider(plausibleSpec);
