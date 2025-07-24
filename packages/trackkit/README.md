# Trackkit Core SDK

> Tiny, privacy-first analytics with built-in adapters (Umami, Plausible, GA4), consent-aware queuing, SSR hydration, and zero remote scripts.

## Install

```bash
npm i trackkit
# or: pnpm add trackkit  /  yarn add trackkit
```

## At a glance

* **Adapters built-in**: `umami`, `plausible`, `ga` (GA4), plus `noop`.
* **No script tags**: everything ships inside your bundle; CSP/MV3 friendly.
* **Consent-aware**: queue or block events until you say go.
* **Queue + overflow**: in-memory buffer with overflow signaling.
* **SSR**: collect on the server, hydrate & replay on the client.
* **Typed DX**: optional event typing and provider types.

## Quick start

```ts
import { init, pageview, track } from 'trackkit';

init({
  provider: 'umami',                      // 'umami' | 'plausible' | 'ga' | 'noop'
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://analytics.example.com',  // required if self-hosting/custom domain
  debug: true,
});

pageview(); // infer URL
track('signup_submitted', { plan: 'starter' });
```

## Configuration (API)

```ts
type ConsentStatus = 'pending' | 'granted' | 'denied';

interface TrackkitOptions {
  /** Analytics provider (default: 'noop') */
  provider?: 'umami' | 'plausible' | 'ga' | 'noop';
  /** Provider-specific site / measurement ID */
  site?: string;
  /** Provider host (self-host / custom domain) */
  host?: string;

  // Runtime behavior
  debug?: boolean;           // log events & state transitions (default: false)
  queueSize?: number;        // max buffered events (default: 50)
  autoTrack?: boolean;       // automatic pageview tracking (default: false)
  doNotTrack?: boolean;      // respect DNT header (default: false)
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

**Environment configuration** (read at build time):

| Env var               | Notes                  |
| --------------------- | ---------------------- |
| `TRACKKIT_PROVIDER`   | default provider       |
| `TRACKKIT_SITE`       | site / measurement ID  |
| `TRACKKIT_HOST`       | analytics host         |
| `TRACKKIT_QUEUE_SIZE` | queue max (default 50) |
| `TRACKKIT_DEBUG`      | `true`/`false`         |

Bundlers: `VITE_*` / `REACT_APP_*` / `NEXT_PUBLIC_*` prefixes supported.

## Public API

```ts
import {
  init, destroy,
  track, pageview, identify,
  setConsent, grantConsent, denyConsent, resetConsent,
  waitForReady, hasQueuedEvents, flushIfReady,
  getConsent, getDiagnostics,
} from 'trackkit';
```

* **`init(opts)`** → creates/returns a facade instance; lazy-loads provider; sets up queues & consent.
* **`track(name, props?, url?)`** → custom event.
* **`pageview(url?)`** → page view; inferred URL if omitted.
* **`identify(userId | null)`** → identify a user (no-op for providers that don’t support it).
* **Consent**: `setConsent('granted'|'denied')`, or helpers `grantConsent()` / `denyConsent()` / `resetConsent()`.
* **Lifecycle**: `destroy()` tears down listeners and clears the in-memory queue.
* **Queue**: `hasQueuedEvents()`, `flushIfReady()` (flushes when provider ready & consent allows).
* **Diagnostics**: `getConsent()`, `getDiagnostics()` (queue size, provider state, etc.).
* **Ready**: `waitForReady()` resolves when the provider is ready.

## Consent behaviors

* **pending**: events (non-essential) are queued.
* **granted**: queue flushes; new events send immediately.
* **denied**: non-essential events are dropped; if `allowEssentialOnDenied` is true, `identify` and similar essential calls may still pass (depends on provider policy).

```ts
init({
  provider: 'ga',
  consent: { initialStatus: 'denied', allowEssentialOnDenied: false },
});
```

## SSR usage

**Server** (collect during render):

```ts
import { track } from 'trackkit';
track('server_render', { path: req.path });
```

**Template injection**:

```ts
import { serializeSSRQueue } from 'trackkit/ssr';
head += serializeSSRQueue(); // adds <script>window.__TRACKKIT_SSR_QUEUE__=...</script>
```

**Client**:

```ts
import { init } from 'trackkit';
init({ provider: 'plausible', site: 'example.com' });
// SSR events are hydrated & replayed automatically when consent permits
```

## Provider specifics (built-in)

* **Umami**: cookieless; no user identification; self-host friendly (`host` required when not using cloud).
* **Plausible**: cookieless; goals & revenue support; 5-minute dashboard delay typical.
* **GA4**: consent-sensitive; supports identify via `user_id`; optional `apiSecret` for Measurement Protocol.

See `docs/providers/*.md` for details & option maps.

## Error handling

You’ll receive structured errors (e.g. queue overflow, init failures):

```ts
init({
  onError: (err: any) => {
    // err.code could be 'QUEUE_OVERFLOW' | 'INIT_FAILED' | ...
    // send to your logger/Sentry
  }
});
```

Queue overflow is signaled when buffered events exceed `queueSize` (default 50). Oldest events are dropped first.

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

## CSP tips / MV3

Add only the endpoints you actually use to `connect-src`. No `script-src` relaxations are required because Trackkit ships in your bundle.

```jsonc
"connect-src": ["'self'","https://cloud.umami.is","https://plausible.io","https://www.google-analytics.com"]
```

## Examples

See `/examples` for:

* Vite SPA demo
* Chrome MV3 extension demo

## License

MIT © Enkosi Ventures

---
