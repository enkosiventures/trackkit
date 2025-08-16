import { PageContext, PlausibleOptions, ProviderOptions } from '../../../types';
import { createConfigProvider, type ProviderSpec } from '../base/adapter';

/**
 * Plausible spec.
 * Only: normalize options, provide endpoints, map payloads.
 * No policy (consent/DNT/localhost/exclusions) and no navigation logic here.
 */
// export type PlausibleOptions = {
//   /** Required: the domain you configured in Plausible (e.g. example.com) */
//   domain: string;
//   /** API host; defaults to official cloud. Use your proxy if set. */
//   host?: string; // e.g. 'https://plausible.io'
//   /** Optional: revenue tracking configuration */
//   revenue?: { currency: string; trackingEnabled: boolean };
// };

function normalizeHost(host?: string): string {
  if (!host) return 'https://plausible.io';
  return host.replace(/\/+$/, '');
}

const plausibleSpec: ProviderSpec<PlausibleOptions> = {
  name: 'plausible',

  version: '1.0.0',

  defaults: (options: ProviderOptions) => {
    const plausibleOptions = options as PlausibleOptions;
    const domain = plausibleOptions.domain?.trim();
    if (!domain) throw new Error('[plausible] "domain" is required');
    return {
      provider: 'plausible',
      domain,
      host: normalizeHost(plausibleOptions.host),
      ...(plausibleOptions.revenue ? { revenue: plausibleOptions.revenue } : {}),
    };
  },

  endpoint: {
    pageview: (options) => ({ url: `${normalizeHost(options.host)}/api/event`, method: 'AUTO' }),
    event:    (options) => ({ url: `${normalizeHost(options.host)}/api/event`, method: 'AUTO' }),
  },

  headers: () => ({}),

  limits: { maxBeaconBytes: 64_000 },

  payload: {
    pageview: (pageContext: PageContext, options: PlausibleOptions) => {
      const body: Record<string, unknown> = {
        name: 'pageview',
        url: pageContext.url,
        domain: options.domain,
      };
      if (pageContext.referrer) body.referrer = pageContext.referrer;
      if (pageContext.title) body.page_title = pageContext.title;
      return body;
    },

    event: (name: string, props: Record<string, unknown>, pageContext: PageContext, options: PlausibleOptions) => {
      const body: Record<string, unknown> = {
        name,
        url: pageContext.url,
        domain: options.domain,
      };
      if (pageContext.referrer) body.referrer = pageContext.referrer;
      if (props && Object.keys(props).length > 0) body.props = props;
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
