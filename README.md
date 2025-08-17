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

## Packages in this monorepo

| Package                   | Path                                 | Purpose                                                       |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| **Core SDK**              | `packages/trackkit`                  | Provider-agnostic runtime + built-ins (Umami, Plausible, GA4) |
| (Optional) React wrapper  | `packages/trackkit-react`            | `<AnalyticsProvider />`, hooks                                |
| (Optional) Vue wrapper    | `packages/trackkit-vue`              | Plugin + composables                                          |
| (Optional) Plugin API     | `packages/trackkit-plugin-api`       | Adapter interface & dev helpers                               |
| (Optional) Example plugin | `packages/trackkit-plugin-amplitude` | Amplitude adapter (opt-in)                                    |

> If you only need the core SDK, install `trackkit` and ignore the rest.

## Quick start (core)

```bash
npm i trackkit     # or: pnpm add trackkit  /  yarn add trackkit
```

```ts
import { init, track, pageview } from 'trackkit';

const analytics = init({
  provider: 'umami',           // 'umami' | 'plausible' | 'ga' | 'noop'
  site: 'de305d54-75b4-431b-adb2',
  host: 'https://cloud.umami.is', // optional; set if self-hosting / custom domain
  debug: true,
});

// send events
pageview();                                 // infers current URL
track('cta_clicked', { plan: 'pro' });      // custom event
```

### Consent (EU-friendly defaults)

```ts
import { init, setConsent } from 'trackkit';

init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  consent: {
    initialStatus: 'pending',      // 'pending' | 'granted' | 'denied'
    requireExplicit: true,         // default: true
    allowEssentialOnDenied: false, // default: false
  },
});

// later, from your banner:
setConsent('granted'); // or 'denied'
```

> When **pending**, events queue in memory; when **granted**, Trackkit flushes the queue; when **denied**, non-essential events are dropped.

### Environment variables

Trackkit reads build-time/public env vars (with common bundler prefixes):

| Var                   | Meaning                                                     |
| --------------------- | ----------------------------------------------------------- |
| `TRACKKIT_PROVIDER`   | default provider (`umami` \| `plausible` \| `ga` \| `noop`) |
| `TRACKKIT_SITE`       | provider site/measurement ID                                |
| `TRACKKIT_HOST`       | analytics host (self-host/custom domain)                    |
| `TRACKKIT_QUEUE_SIZE` | max buffered events (default: 50)                           |
| `TRACKKIT_DEBUG`      | `true`/`false`                                              |

**Bundlers:**

* Vite → `VITE_TRACKKIT_*`
* CRA → `REACT_APP_TRACKKIT_*`
* Next.js → `NEXT_PUBLIC_TRACKKIT_*`

### Multi-provider (mirror critical events)

```ts
import { init, track, setConsent } from 'trackkit';

// privacy baseline for all users
const priv = init({ provider: 'plausible', site: 'example.com' });

// add GA4 only if user consents to marketing
setConsent('pending');
function onConsentGranted() {
  const ga = init({ provider: 'ga', site: 'G-XXXXXXXXXX' });
  // mirror important events
  track('signup_completed', { plan: 'pro' });
}
```

### SSR hydration

**Server:**

```ts
import { track } from 'trackkit';
// …during render:
track('server_render', { path: req.path });
```

**HTML template:**

```html
<head>
  <!-- inject SSR queue -->
  {{ serializeSSRQueue() }}
</head>
```

**Client:** Trackkit hydrates and replays SSR events on `init()` when consent allows.

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
2. `pnpm dev` (watch mode)
3. Keep bundle budgets green (`pnpm size`).
4. Conventional Commits, please.
5. New provider? See **Provider Adapter API** in docs.

## License

MIT © Enkosi Ventures

---
