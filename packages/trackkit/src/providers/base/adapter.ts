import { PageContext, ProviderInstance, ProviderType } from '../../types';
import { send, type TransportMethod } from './transport';


/**
 * Declarative provider spec → concrete ProviderInstance
 * This consolidates 90% of provider differences into tiny “spec” modules.
 */
export type ProviderSpec<ProviderOptions> = {
  name: ProviderType;

  version: string;

  /** Normalize/validate options; apply defaults. Throw for missing required fields. */
  defaults: (options: ProviderOptions) => ProviderOptions;

  /** Endpoints & transport preferences. */
  endpoint: {
    pageview: (options: ProviderOptions) => { url: string; method?: TransportMethod };
    event:    (options: ProviderOptions) => { url: string; method?: TransportMethod };
  };

  /** Optional headers function (e.g., auth tokens) */
  headers?: (options: ProviderOptions) => Record<string, string>;

  /** Beacon size guard, etc. */
  limits?: { maxBeaconBytes?: number };

  /** Map from our PageContext to provider’s payload for pageview/event. */
  payload: {
    pageview: (pageContext: PageContext, options: ProviderOptions) => Record<string, unknown>;
    event:    (name: string, props: Record<string, unknown>, pageContext: PageContext, options: ProviderOptions) => Record<string, unknown>;
  };

  /** Optional success predicate; default is Response.ok */
  ok?: (res: Response) => boolean;

  /** Optional custom error mapper for nicer diagnostics */
  parseError?: (res: Response) => Promise<Error>;
};

function defaultOk(res: Response) { return res.ok; }

async function defaultParseError(res: Response): Promise<Error> {
  let detail = '';
  try { detail = await res.text(); } catch {}
  return new Error(`Provider request failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
}

export function createConfigProvider<ProviderOptions>(spec: ProviderSpec<ProviderOptions>) {
  return {
    /** Factory to keep parity with your existing “provider factories” */
    create(options: ProviderOptions, cache?: boolean): ProviderInstance {
      const providerOptions = spec.defaults(options);
      const headers = spec.headers?.(providerOptions);
      const ok = spec.ok ?? defaultOk;
      const parseError = spec.parseError ?? defaultParseError;

      const sendAndCheck = async (method: TransportMethod, url: string, body: unknown) => {
        const res = await send({
          method, url, headers, body,
          maxBeaconBytes: spec.limits?.maxBeaconBytes,
          cache,
        });
        if (!ok(res)) throw await parseError(res);
      };

      const instance: ProviderInstance = {
        name: spec.name,

        pageview(pageContext: PageContext) {
          const { url: endpoint, method = 'AUTO' } = spec.endpoint.pageview(providerOptions);
          const body = spec.payload.pageview(pageContext, providerOptions);
          return sendAndCheck(method, endpoint, body);
        },

        track(
          name: string,
          props: Record<string, unknown>,
          pageContext?: PageContext
        ) {
          // Use pageContext.url if provided; otherwise derive minimal current URL.
          const pageContextSafe: PageContext = pageContext ?? {
            url:
              typeof window !== 'undefined'
                ? window.location.pathname + window.location.search + window.location.hash
                : '/',
            timestamp: Date.now(),
          };
          const { url: endpoint, method = 'AUTO' } = spec.endpoint.event(providerOptions);
          const body = spec.payload.event(name, props ?? {}, pageContextSafe, providerOptions);
          return sendAndCheck(method, endpoint, body);
        },

        identify(_userId: string | null) {
          // Most privacy-first providers don’t support identify; keep as noop.
        },

        destroy() {
          // No resources to clean up in the config adapter by default.
        },
      };

      return instance;
    },

    meta: {
      name: spec.name,
      version: spec.version,
    }
  };
}
