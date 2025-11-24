# Trackkit Core SDK

> Tiny, privacy-first analytics with built-in bundled adapters (Umami, Plausible, GA4), consent-aware queuing, SSR hydration, and zero remote scripts.


## Install

```bash
npm i trackkit
# or: pnpm add trackkit  /  yarn add trackkit
```

## At a glance

* **Adapters built-in**: `umami`, `plausible`, `ga4`, plus `noop`.
* **No script tags**: everything ships inside your bundle; CSP/MV3 friendly.
* **Consent-aware**: queue or block events until you say go.
* **Queue + overflow**: in-memory buffer with overflow signaling.
* **SSR**: collect on the server, hydrate & replay on the client.
* **Typed DX**: optional event typing and provider types.


## Usage

Trackkit exposes a small facade API with both instance and singleton usage styles.

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'umami',
  site: 'your-site-id',
});

analytics.pageview();
analytics.track('signup_submitted', { plan: 'starter' });
```

For full documentation, see the **Quickstart**, detailed guides, API reference, and example applications on the **[Trackkit docs site](https://enkosiventures.github.io/trackkit)**.


## Configuration (API)

```ts
type ConsentStatus = 'pending' | 'granted' | 'denied';

interface TrackkitOptions {
  /** Analytics provider (default: 'noop') */
  provider?: 'umami' | 'plausible' | 'ga4' | 'noop';
  /** Provider-generic application identifier */
  site?: string;
  /** Provider host (self-host / custom domain) */
  host?: string;

  // Runtime behavior
  debug?: boolean;           // log events & state transitions (default: false)
  queueSize?: number;        // max buffered events (default: 50)
  autoTrack?: boolean;       // automatic pageview tracking (default: false)
  doNotTrack?: boolean;      // respect DNT header (default: true)
  trackLocalhost?: boolean;  // include localhost events (default: true)
  includeHash?: boolean;     // SPA hash-based routing (default: false)
  allowWhenHidden?: boolean; // allow send on hidden tabs (default: false)
  transport?: 'auto' | 'beacon' | 'fetch' | 'xhr';

  // Domain policy
  domains?: string[];        // whitelist of allowed hostnames

  // Consent
  consent?: {
    initialStatus?: ConsentStatus;    // default: 'pending'
    requireExplicit?: boolean;        // default: true
    disablePersistence?: boolean;     // default: false
    policyVersion?: string;           // re-prompt if version changes
    allowEssentialOnDenied?: boolean; // default: false
  };

  // Errors
  onError?: (err: unknown) => void;
}
```

For detailed event gating behaviour, see the **Event Interaction Table** in the **[Queue Management](https://enkosiventures.github.io/trackkit/guides/queue-management#event-interaction-model)** guide.

**Environment configuration** (read at build time):

| Env var               | Notes                  |
| --------------------- | ---------------------- |
| `TRACKKIT_PROVIDER`   | default provider       |
| `TRACKKIT_SITE`       | site / measurement ID  |
| `TRACKKIT_HOST`       | analytics host         |
| `TRACKKIT_QUEUE_SIZE` | queue max (default 50) |
| `TRACKKIT_DEBUG`      | `true`/`false`         |

Bundlers: `VITE_*` / `REACT_APP_*` prefixes are supported directly. For other environments (including Next.js), either:

* use `TRACKKIT_*` and a small custom loader that passes values into `init`, or
* inject config at runtime (see `docs/api/configuration.md` for `window.__TRACKKIT_ENV__` and `<meta>`-tag options).

> The complete set of options and keys can be found in the **[Configuration Documentation](https://enkosiventures.github.io/trackkit/reference/configuration)**

## Public API

| Function | Instance? | Singleton? | Description |
|---------|-----------|-------------|-------------|
| `createAnalytics(opts)` | ✔️ | — | Creates an isolated facade instance. Preferred for modern apps. |
| `init(opts)` | — | ✔️ | Initializes the global singleton façade. |
| `destroy()` | ✔️ | ✔️ | Tears down listeners, clears queues. |
| `track(name, props?, url?)` | ✔️ | ✔️ | Sends a custom analytics event. |
| `pageview(url?)` | ✔️ | ✔️ | Sends a pageview (or inferred URL). |
| `identify(userId?)` | ✔️ | ✔️ | Identifies a user; provider-specific behaviour applies. |
| `grantConsent()` | ✔️ | ✔️ | Set consent → `granted`, flush queue. |
| `denyConsent()` | ✔️ | ✔️ | Set consent → `denied`, drop analytics items. |
| `resetConsent()` | ✔️ | ✔️ | Return consent to `pending`. |
| `setConsent(status)` | ✔️ | ✔️ | Directly set status. |
| `getConsent()` | ✔️ | ✔️ | Return current consent snapshot. |
| `waitForReady()` | ✔️ | ✔️ | Promise that resolves when provider is ready. |
| `flushIfReady()` | ✔️ | ✔️ | Flush queue if provider + consent allow. |
| `hasQueuedEvents()` | ✔️ | ✔️ | Indicates buffer state. |
| `getDiagnostics()` | ✔️ | ✔️ | Internal state snapshot (provider, queue, consent, URLs). |

All SSR functions are imported from `trackkit/ssr`:

| Function | Purpose |
|----------|---------|
| `serializeSSRQueue()` | Emit `<script>` hydration payload. |
| `getSSRQueue()` | Retrieve queue array (server only). |
| `enqueueSSREvent()` | Low-level queue write. |
| `getSSRQueueLength()` | Convenience helper |
| `ssrTrack/ssrPageview/ssrIdentify` | Server-side variants that queues instead of dispatching. |

> See the **[API Reference](https://enkosiventures.github.io/trackkit/reference/api)** documentation for a more thorough walkthrough 


## Built-in Provider specifics

* **Umami**: cookieless; self-host friendly (`host` required when not using cloud). `identify()` is implemented as a no-op for compatibility with the facade.
* **Plausible**: cookieless; goals & revenue support; 5-minute dashboard delay typical.
* **GA4**: consent-sensitive; supports identify via `user_id`; optional `apiSecret` for Measurement Protocol.

All providers follow Trackkit’s gating rules (**PolicyGate → Consent → Provider** readiness). Provider-specific behaviour applies after that.

See the **[Provider Guides](https://enkosiventures.github.io/trackkit/providers/umami)** for complete details.


## TypeScript niceties

Optionally type your events:

```ts
type Events = {
  signup_submitted: { plan: 'free' | 'pro' };
  purchase_completed: { amount: number; currency: 'USD'|'EUR' };
};

// If your project exposes a TypedAnalytics<> helper, you can cast.
// Otherwise, just rely on your own wrappers/types around `track`.
```

(Trackkit’s core API is fully typed; strict event typing can be layered via your app types or helper wrappers.)


## License

MIT © Enkosi Ventures
