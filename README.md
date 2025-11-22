# TrackKit

```txt
TrackKit — tiny, privacy-first web analytics
────────────────────────────────────────────
Core SDK • Built-in Umami/Plausible/GA4 • SSR-aware
MV3-safe • No remote scripts • <6 kB browser core
```

## Why Trackkit?

* **Privacy-first**: cookieless by default for Umami & Plausible; consent-aware for GA4.
* **No remote scripts**: CSP-friendly, safe for MV3 extensions, workers, and strict sites.
* **Small & fast**: tree-shakeable core; adapters load lazily.
* **Multi-provider**: run Umami/Plausible for everyone and layer GA4 for consented users.
* **SSR aware**: queue on the server, hydrate and replay on the client.
* **DX matters**: typed API, debug logs, queue inspection, provider state machine.

## Documentation

- **Quickstart:** [`docs/overview/quickstart.md`](docs/overview/quickstart.md)
- **Full docs (local):** run `pnpm docs:dev` and open [`http://localhost:5173`](http://localhost:5173).

## Packages in this monorepo

| Package                   | Path                                 | Status      | Purpose                                                       |
| ------------------------- | ------------------------------------ | ----------- | ------------------------------------------------------------- |
| **Core SDK**              | `packages/trackkit`                  | available   | Provider-agnostic runtime + built-ins (Umami, Plausible, GA4) |
| React wrapper             | `packages/trackkit-react`            | planned     | `<AnalyticsProvider />`, hooks                                |
| Vue wrapper               | `packages/trackkit-vue`              | planned     | Plugin + composables                                          |
| Plugin API                | `packages/trackkit-plugin-api`       | planned     | Adapter interface & dev helpers                               |
| Example plugin            | `packages/trackkit-plugin-amplitude` | planned     | Amplitude adapter (opt-in)                                    |

## Quick start (Core SDK)

```bash
npm i trackkit     # or: pnpm add trackkit  /  yarn add trackkit
```

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'umami',                      // 'umami' | 'plausible' | 'ga4' | 'noop'
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://analytics.example.com',  // required if self-hosting/custom domain
  debug: true,
});

// send events
analytics.pageview();
analytics.track('signup_submitted', { plan: 'starter' });
```

> Trackkit supports a unified `site` identifier for all providers; see the **[Configuration](https://enkosiventures.github.io/trackkit/reference/configuration#programmatic-init-recommended)** reference.

### Instances vs singleton helpers

The example above use the **instance API**.

Most apps should prefer **instances**:

- You can scope analytics to a particular app, tab, widget, or test.
- It’s easier to reason about SSR, multi-tenant setups, and tests.
- You avoid hidden global state.

However, if you prefer a global approach, you can use the included singleton helpers instead:

```ts
// Singleton convenience API

import { init, pageview, track } from 'trackkit';

init({ provider: 'umami', site: '...' });
pageview();
track('signup_submitted', { plan: 'starter' });
```

Internally, both forms hit the same core sdk.

### Consent (EU-friendly defaults)

```ts
import { createAnalytics /* or init, grantConsent */ } from 'trackkit';

const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  consent: {
    initialStatus: 'pending',      // 'pending' | 'granted' | 'denied'
    requireExplicit: true,         // default: true
    allowEssentialOnDenied: false, // default: false
  },
});

// later, from your consent banner:
analytics.grantConsent(); // or denyConsent();
```

> **Trackkit is consent-aware:** events are queued until consent and provider readiness allow them to be sent, and non-essential analytics follow your configured policy.
> For full behaviour, see the **[Consent & Privacy](https://enkosiventures.github.io/trackkit/guides/consent-and-privacy)** guide.

### Environment variables

Trackkit reads build-time/public env vars (with common bundler prefixes):

| Var                   | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| `TRACKKIT_PROVIDER`   | default provider (`umami` \| `plausible` \| `ga4` \| `noop`) |
| `TRACKKIT_SITE`       | provider site/measurement ID                                 |
| `TRACKKIT_HOST`       | analytics host (self-host/custom domain)                     |
| `TRACKKIT_QUEUE_SIZE` | max buffered events (default: 50)                            |
| `TRACKKIT_DEBUG`      | `true`/`false`                                               |

**Bundlers:**

* Vite → `VITE_TRACKKIT_*`
* CRA → `REACT_APP_TRACKKIT_*`
* Generic/Node → `TRACKKIT_*`

For Next.js, prefer runtime injection or a small custom loader that passes values into `init` at startup (see `docs/api/configuration.md` for details).

### Multiple Providers

Trackkit supports multiple providers.
See the **[Choosing a Provider](https://enkosiventures.github.io/trackkit/guides/ssr#running-multiple-providers)** guide for more information.

### SSR

Trackkit queues events during server rendering and hydrates them on the client.
See the **[Server-Side Rendering](https://enkosiventures.github.io/trackkit/guides/ssr)** guide for full semantics.

### CSP / MV3

Add the providers you use to `connect-src`. Example:

```jsonc
"connect-src": [
  "'self'",
  "https://cloud.umami.is",
  "https://plausible.io",
  "https://www.google-analytics.com"
]
```

### Repo scripts

| Command      | What it does                   |
| ------------ | ------------------------------ |
| `pnpm build` | Build all packages             |
| `pnpm test`  | Vitest unit/integration suites |
| `pnpm lint`  | ESLint + Prettier              |
| `pnpm size`  | Gzip size budget report        |

## Contributing

1. `pnpm i`
2. `pnpm build` (or `pnpm -r run build:watch` for watch mode)
3. Keep bundle budgets green (`pnpm size`).
4. Conventional Commits, please.
5. New provider? See **Provider Adapter API** in docs.

## License

MIT © Enkosi Ventures

---
