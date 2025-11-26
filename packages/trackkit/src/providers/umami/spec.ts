import { UMAMI_ENDPOINT, UMAMI_HOST } from '../../constants';
import type { EventType, PageContext } from '../../types';
import { displaySizeFromContext } from '../browser';
import { createConfigProvider, type ProviderSpec } from '../base/adapter';
import type { UmamiOptions, UmamiPayload, UmamiSendBody } from './types';


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

  defaults: (options: UmamiOptions) => {
    const website = options.website?.trim();
    if (!website) throw new Error('[umami] "website" is required');
    return {
      provider: 'umami',
      website,
      host: normalizeHost(options.host),
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
    pageview: (pageContext, options): UmamiSendBody => ({
      type: 'event' as EventType,
      payload: {
        name: 'pageview',
        website: options.website,
        ...getUmamiPageContext(pageContext),
      } satisfies UmamiPayload,
    }),

    event: (name, props, pageContext, options): UmamiSendBody => ({
      type: 'event' as EventType,
      payload: {
        name,
        website: options.website,
        ...getUmamiPageContext(pageContext),
        ...(props ? { data: props } : {}),
      } satisfies UmamiPayload,
    }),
  },
};

export default createConfigProvider(umamiSpec);
