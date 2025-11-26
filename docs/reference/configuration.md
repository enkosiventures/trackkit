# Configuration

Trackkit can be configured via:

- **Programmatic options** (recommended, most flexible)
- **Environment variables** (build-time)
- **Runtime injection** (e.g. HTML template / CDN)

Runtime and programmatic config always win over build-time env.


## Resolution & precedence

When resolving a key like `PROVIDER`, Trackkit looks in this order:

1. **Programmatic options**

   Whatever you pass to `createAnalytics(opts)` / `init(opts)` is the top source of truth.

2. **Runtime injection**

   - `window.__TRACKKIT_ENV__`, e.g. `{ PROVIDER: "umami" }`
   - `<meta name="TRACKKIT_PROVIDER" content="umami">`

3. **Build-time env (suffix after `TRACKKIT_`)**

   - `TRACKKIT_PROVIDER`
   - `VITE_TRACKKIT_PROVIDER`
   - `REACT_APP_TRACKKIT_PROVIDER`

> Keys in `window.__TRACKKIT_ENV__` should be **UPPERCASE** and match the suffix after `TRACKKIT_` (e.g. `PROVIDER`, `SITE`, `HOST`, `QUEUE_SIZE`).


## Common keys (env + runtime injection)

These keys can be supplied via:

- `window.__TRACKKIT_ENV__`
- `<meta name="TRACKKIT_*">`
- `TRACKKIT_*` / `VITE_TRACKKIT_*` / `REACT_APP_TRACKKIT_*` env variables

They map onto the corresponding TypeScript options on the facade.

| Key | Type | Description | Default (effective) |
|-----|------|-------------|---------------------|
| `PROVIDER` | string | Analytics provider (`umami`, `plausible`, `ga4`, `noop`) | `'noop'` |
| `SITE` | string | Generic provider application identifier | — (aliases `WEBSITE` / `DOMAIN` / `MEASUREMENT_ID`) |
| `WEBSITE` / `DOMAIN` / `MEASUREMENT_ID` | string | Provider-specific application identifiers | — (either specific or generic identifier required) |
| `HOST` | string | Analytics base URL (where applicable) | Provider default (`UMAMI_HOST`, `PLAUSIBLE_HOST`, `GA_HOST`) |
| `QUEUE_SIZE` | number | Max in-memory facade queue size | `50` |
| `DEBUG` | boolean (`true`/`false`/`1`/`0`) | Verbose debug logging | `false` |
| `AUTO_TRACK` | boolean | Enable SPA navigation autotracking | `true` |
| `DO_NOT_TRACK` | boolean | Respect browser’s DNT (set `false` to ignore) | `true` |
| `TRACK_LOCALHOST` | boolean | Send events from `localhost` | `true` (may be overridden by provider metadata) |
| `INCLUDE_HASH` | boolean | Include `#hash` in URLs | `false` |
| `DOMAINS` | string / JSON | Allowed hostnames, e.g. `"app.example.com,www.example.com"` or `["app.example.com"]` | allow all |
| `EXCLUDE` | string / JSON | URL substrings to exclude, e.g. `"/admin,/debug"` or `["/admin"]` | none |
| `BATCH_SIZE` | number | Max events per facade batch | `10` |
| `BATCH_TIMEOUT` | number (ms) | Max delay before a facade batch flushes | `1000` |
| `TRANSPORT` | string | Transport hint (`'auto'`, `'fetch'`, `'beacon'`) | `'auto'` |
| `DEFAULT_PROPS` | JSON | Extra properties merged into events | — |
| `CONSENT` | JSON | Initial consent policy (see below) | see **Consent defaults** |

A few important details:

- `DOMAINS` / `EXCLUDE` are only applied for **pageview** events (via the PolicyGate).
- `BATCH_SIZE` / `BATCH_TIMEOUT` now back real batching behaviour; they are **not reserved** knobs.
- `TRACK_LOCALHOST` can still be influenced by provider metadata (e.g. a provider that never tracks `localhost` even if you ask).

### Build tool prefixes

- Vite: `VITE_TRACKKIT_*`
- Create React App: `REACT_APP_TRACKKIT_*`
- Generic/Node: `TRACKKIT_*`

> For Next.js, prefer **runtime injection** or a custom config loader; the current env reader does not treat `NEXT_PUBLIC_*` specially.


## Runtime injection

Inject config at runtime (e.g. in HTML served by your app or via your CDN):

```html
<script>
  window.__TRACKKIT_ENV__ = {
    PROVIDER: "umami",
    SITE: "your-site-id",
    HOST: "https://analytics.example.com",
    DEBUG: "true",
    AUTO_TRACK: "true",
    QUEUE_SIZE: "100"
  };
</script>
````

You can also use meta tags for simple keys:

```html
<meta name="TRACKKIT_PROVIDER" content="plausible">
<meta name="TRACKKIT_SITE" content="site-123">
<meta name="TRACKKIT_HOST" content="https://plausible.example.com">
```

String values like `"true"` / `"false"` / `"1"` / `"0"` are parsed to booleans where appropriate.


## Programmatic init (recommended)

Programmatic config is the “source of truth” and always wins over env/runtime injection.

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'plausible',
  site: 'site-123',
  host: 'https://plausible.example.com',
  debug: true,
  autoTrack: true,
  queueSize: 50,
});
```

You can still use the singleton API if you prefer:

```ts
import { init } from 'trackkit';

init({
  provider: 'umami',
  site: 'abc-123',
  host: 'https://analytics.example.com',
});
```

Both APIs flow through the same normalisation / validation path.

> **Unified Identifier (`site`)**
> Trackkit accepts a generic `site` field as a provider-agnostic identifier.
> When used, it is mapped automatically:
>
> * Umami → `website`
> * Plausible → `site`
> * GA4 → `measurementId`
>
> Provider-specific identifiers (`website`, `measurementId`, etc.) can still be supplied directly and will override the generic mapping.
> This enables painless provider switching without rewriting configuration.


## Advanced programmatic options

Some options are **only** expected to be set programmatically (not via env):

* `retry`
* `resilience`
* `connection`
* `performance`
* detailed `consent` configuration

These shapes are defined in TypeScript; use your editor’s IntelliSense (or the source files) as the canonical reference.

### Retry

Controls backoff and retry for network dispatch.

Defaults (from `RETRY_DEFAULTS`):

```ts
retry: {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}
```

Override with:

```ts
const analytics = createAnalytics({
  // ...
  retry: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 60000,
  },
});
```

### Resilience & transports

Controls adblocker detection and transport fallback. Defaults (from `RESILIENCE_DEFAULTS`):

```ts
resilience: {
  detectBlockers: false,
  fallbackStrategy: 'proxy', // 'proxy' | 'beacon' | 'none'
  proxy: undefined,
}
```

Example with a first-party proxy:

```ts
const analytics = createAnalytics({
  // ...
  resilience: {
    detectBlockers: true,
    fallbackStrategy: 'proxy',
    proxy: {
      proxyUrl: '/api/trackkit-proxy',
      token: process.env.TRACKKIT_PROXY_TOKEN,
      headers: { 'X-Trackkit-Source': 'web' },
    },
  },
});
```

See `docs/guides/resilience-and-transports.md` for the full story.

### Connection & offline

Controls how Trackkit interprets connection health and, if you wire it, how you use offline storage.

Defaults (from `CONNECTION_DEFAULTS`):

```ts
connection: {
  monitor: false,
  offlineStorage: false,
  syncInterval: 30000, // ms
  slowThreshold: 3000, // ms
  checkInterval: 30000, // ms
}
```

Example:

```ts
const analytics = createAnalytics({
  // ...
  connection: {
    monitor: true,
    offlineStorage: true,
    syncInterval: 15000,
    slowThreshold: 5000,
  },
});
```

The actual connection state / offline behaviour is driven by `ConnectionMonitor` and `OfflineStore`; see `docs/guides/connection-and-offline.md`.

### Performance tracking

Controls the lightweight `PerformanceTracker`.

Defaults (from `PERFORMANCE_DEFAULTS`):

```ts
performance: {
  enabled: false,
  // other fields may exist; see PerformanceOptions in the source
}
```

Example:

```ts
const analytics = createAnalytics({
  // ...
  performance: {
    enabled: true,
  },
});
```

When enabled and wired in, basic metrics (init time, average processing time, average network latency) become visible via `getDiagnostics()`. See `docs/guides/performance-tracking.md` for details.

### Consent

The consent system has its own defaults (from `CONSENT_DEFAULTS`):

```ts
consent: {
  initialStatus: 'pending',
  requireExplicit: true,
  allowEssentialOnDenied: false,
  disablePersistence: false,
  storageKey: '__trackkit_consent__',
}
```

You can override any of these:

```ts
const analytics = createAnalytics({
  // ...
  consent: {
    initialStatus: 'denied',
    requireExplicit: true,
    allowEssentialOnDenied: true,
    storageKey: '__myapp_consent__',
  },
});
```

If you prefer a coarse env-driven approach, you can use a `CONSENT` JSON env value:

```sh
TRACKKIT_CONSENT={"initialStatus":"denied","requireExplicit":true}
```

Programmatic consent config always wins over env.


## Provider-specific notes

### Umami

* **Required:** `site` (or `website`)
* Optional: `host` (`TRACKKIT_HOST` or `host` option). Defaults to `https://api.umami.is`.

Example:

```sh
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=abc-123
TRACKKIT_HOST=https://umami.example.com
```

### Plausible

* **Required:** `site`
* Optional: `host`. Defaults to `https://plausible.io`.

Example:

```sh
TRACKKIT_PROVIDER=plausible
TRACKKIT_SITE=mydomain.com
TRACKKIT_HOST=https://plausible.example.com
```

### GA4

* **Required:** `measurementId` (programmatic) or `MEASUREMENT_ID` (env/runtime).
* Host defaults to GA’s standard endpoints.

Example:

```sh
TRACKKIT_PROVIDER=ga4
TRACKKIT_MEASUREMENT_ID=G-XXXXXXX
```

Programmatic:

```ts
createAnalytics({
  provider: 'ga4',
  measurementId: 'G-XXXXXXX',
});
```


## Error handling

Trackkit surfaces typed errors via `AnalyticsError` with codes like:

* `INIT_FAILED`
* `PROVIDER_ERROR`
* `NETWORK_ERROR`
* `QUEUE_OVERFLOW`
* `INVALID_CONFIG`
* `INVALID_ENVIRONMENT`
* `CONSENT_REQUIRED`
* `POLICY_BLOCKED`
* `READY_TIMEOUT`
* `TIMEOUT`
* `UNKNOWN`

You can supply a custom handler:

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  onError: (error) => {
    // error is an AnalyticsError
    console.error('[analytics]', error.code, error.message, {
      provider: error.provider,
      timestamp: error.timestamp,
    });
    // e.g. forward to Sentry / Datadog here
  },
});
```

If you don’t provide `onError`, Trackkit logs deduplicated errors via its internal logger.


## Debug mode

Enable detailed logs:

```ts
createAnalytics({ debug: true });
// or via env
TRACKKIT_DEBUG=true
```

Debug mode controls:

* verbose queue / consent / navigation logs,
* diagnostics output where enabled,
* provider lifecycle traces.

Use `debug: true` in development and staging; keep it `false` in production unless you’re actively investigating an issue.
