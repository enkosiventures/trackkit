import { UMAMI_ENDPOINT, UMAMI_HOST } from '../../constants';
import type { PageContext, ProviderOptions, UmamiOptions } from '../../types';
import { displaySizeFromContext } from '../shared/browser';
import { createConfigProvider, type ProviderSpec } from '../base/adapter';


function normalizeHost(host?: string): string {
  const base = host ?? UMAMI_HOST;
  return base.replace(/\/+$/, '');
}

export function getUmamiPageContext(pageContext: PageContext): Record<string, unknown> {
  const { url, referrer, title, language, hostname, userId } = pageContext;
  const umamiPageContext = {
    url,
    referrer,
    title,
    language,
    hostname,
    id: userId,
    screen: displaySizeFromContext(pageContext),
  };
  return umamiPageContext;
}

const umamiSpec: ProviderSpec<UmamiOptions> = {
  name: 'umami',

  version: '1.0.0',

  defaults: (options: ProviderOptions) => {
    const website = (options as UmamiOptions).website?.trim();
    if (!website) throw new Error('[umami] "website" is required');
    return {
      provider: 'umami',
      website,
      host: normalizeHost((options as UmamiOptions).host),
    };
  },

  endpoint: {
    pageview: (options) => {
      return { 
        url: `${normalizeHost(options.host)}${UMAMI_ENDPOINT}`, 
        method: 'AUTO' 
      };
    },
    event: (options) => {
      return {
        url: `${normalizeHost(options.host)}${UMAMI_ENDPOINT}`,
        method: 'AUTO'
      };
    },
  },

  headers: () => ({}),

  payload: {
    pageview: (pageContext, options) => ({
      type: 'event',
      payload: {
        name: 'pageview',
        website: options.website,
        data: {},
        ...getUmamiPageContext(pageContext),
      },
    }),

    event: (name, props, pageContext, options) => ({
      type: 'event',
      payload: {
        name,
        website: options.website,
        data: props ?? {},
        ...getUmamiPageContext(pageContext),
      },
    }),
  },
};

export default createConfigProvider(umamiSpec);
