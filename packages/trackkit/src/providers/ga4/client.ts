import { GA4Options, PageContext, ProviderInstance, ProviderOptions } from '../../types';
import { send, type TransportMethod } from '../base/transport';

/**
 * Minimal GA4 client.
 * - Uses Measurement Protocol (MP) endpoint by default.
 * - Optionally uses the /debug endpoint when debug is true.
 * - Leaves full session/campaign handling to your facade (or add here if you prefer).
 */
// export type GA4Options = {
//   /** Required: GA4 Measurement ID, e.g. 'G-XXXXXXX' */
//   measurementId: string;
//   /** Optional: API secret if using server-side proxy or MP secret. */
//   apiSecret?: string;
//   /** Debug mode: sends to debug endpoint for validation. */
//   debug?: boolean;
//   /** Host override (rare) */
//   host?: string; // defaults to 'https://www.google-analytics.com'
// };

function normalizeHost(h?: string): string {
  return (h ?? 'https://www.google-analytics.com').replace(/\/+$/, '');
}

// Very small client ID generator (if you need a stable one, persist to storage/cookie)
function getOrCreateCid(): string {
  try {
    const key = '_ga4_cid';
    const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (existing) return existing;
    const cid = `${Math.floor(Math.random() * 1e10)}.${Date.now()}`;
    localStorage?.setItem(key, cid);
    return cid;
  } catch {
    // Fallback ephemeral
    return `${Math.floor(Math.random() * 1e10)}.${Date.now()}`;
  }
}

function getOrCreateSessionId(): number {
  try {
    const key = '_ga4_sid';
    const v = sessionStorage.getItem(key);
    if (v && /^\d+$/.test(v)) return Number(v);
    const sid = Math.floor(Date.now() / 1000); // simple numeric
    sessionStorage.setItem(key, String(sid));
    return sid;
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

export function createGA4Client(options: ProviderOptions): ProviderInstance {
  const ga4Options = options as GA4Options;
  const measurementId = ga4Options.measurementId?.trim();
  if (!measurementId) throw new Error('[ga4] "measurementId" is required');

  const host = normalizeHost(ga4Options.host);
  const debugEndpoint = !!ga4Options.debugEndpoint;

  // Build endpoint
  const base = debugEndpoint ? `${host}/debug/mp/collect` : `${host}/mp/collect`;

  // Optional: API secret is required for MP collect in many configs; adapt to your infra
  const apiSecret = ga4Options.apiSecret?.trim() ?? '';
  const endpoint = apiSecret
    ? `${base}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`
    : `${base}?measurement_id=${encodeURIComponent(measurementId)}`;

  const method: TransportMethod = 'AUTO';
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  function createContextParams(ctx?: PageContext): Record<string, unknown> {
    if (!ctx) return {};

    const params: Record<string, unknown> = {};
    if (ctx.url) params.page_location = ctx.url;
    if (ctx.referrer) params.page_referrer = ctx.referrer;
    if (ctx.title) params.page_title = ctx.title;
    if (ctx.language) params.language = ctx.language;
    if (ctx.screenSize && ctx.screenSize.width > 0 && ctx.screenSize.height > 0) {
      params.screen_resolution = `${ctx.screenSize.width}x${ctx.screenSize.height}`;
    }

    return params;
  }

  const sendEvents = async (
    events: Array<{ name: string; params?: Record<string, unknown> }>,
    ctx?: PageContext,
    consent?: { ad_user_data?: 'GRANTED' | 'DENIED'; ad_personalization?: 'GRANTED' | 'DENIED' },
  ) => {
    const sid = getOrCreateSessionId();
    const contextParams = createContextParams(ctx);

    const enhancedEvents = events.map(event => ({
      name: event.name,
      params: {
        ...event.params,        // Original params
        ...contextParams,       // Context params
        session_id: sid,        // Session info
        engagement_time_msec: event.params?.engagement_time_msec ?? 100,
      }
    }));

    const payload: Record<string, unknown> = {
      client_id: getOrCreateCid(),
      events: enhancedEvents,
    };

    if (consent && (consent.ad_user_data || consent.ad_personalization)) {
      payload.consent = consent; // GA4 MP consent object
    }

    const res = await send({ method, url: endpoint, headers, body: payload, maxBeaconBytes: 64_000 });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[ga4] request failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
    }
  };

  const instance: ProviderInstance = {
    name: 'ga4',

    pageview(pageContext: PageContext) {
      const params: Record<string, unknown> = { page_location: pageContext.url };
      return sendEvents([{ name: 'page_view', params: {} }], pageContext);
    },

    track(name: string, props: Record<string, unknown>, pageContext: PageContext) {
      return sendEvents([{ name, params: { ...(props ?? {}) } }], pageContext);
    },

    identify(_userId: string | null) {
      // Optional: you can set user_id with a dedicated event if you want:
      // return sendEvents([{ name: 'set_user_id', params: { user_id: _userId ?? undefined } }]);
    },

    destroy() { /* no-op */ },
  };

  return instance;
}
