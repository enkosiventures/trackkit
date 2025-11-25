# Trackkit

[![npm](https://img.shields.io/npm/v/trackkit.svg)](https://www.npmjs.com/package/trackkit)
[![CI](https://github.com/enkosiventures/trackkit/actions/workflows/ci.yml/badge.svg)](https://github.com/enkosiventures/trackkit/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/bundlephobia/minzip/trackkit)](https://bundlephobia.com/package/trackkit)
![types](https://img.shields.io/npm/types/trackkit)

Trackkit is a lightweight, provider-agnostic analytics SDK with a single facade for Umami, Plausible, GA4 (Measurement Protocol only), and custom adapters.  
This repository hosts the full SDK source, development tooling, documentation, tests, and release pipeline.

**SSR-aware • MV3-safe • No remote scripts • <20 kB core (brotli)**

- **Zero remote scripts** — CSP-friendly and safe for MV3 and strict environments.  
- **Consent-aware** — EU-style consent flows with event gating + queueing.  
- **SSR hydration** — collect server events and replay once on the client.  
- **Multi-provider** — Umami/Plausible baseline with optional GA4 layer.  
- **Typed DX** — clean facade API, strong TypeScript types, great developer tooling.  

## Why Trackkit?

* **Privacy-first**: cookieless by default for Umami & Plausible; consent-aware for GA4.
* **No remote scripts**: CSP-friendly, safe for MV3 extensions, workers, and strict sites.
* **Small & fast**: tree-shakeable core; adapters load lazily.
* **Multi-provider**: run Umami/Plausible for everyone and layer GA4 for consented users.
* **SSR aware**: queue on the server, hydrate and replay on the client.
* **DX matters**: typed API, debug logs, queue inspection, provider state machine.

## Documentation

Visit Trackkit's **[full documentation site](https://enkosiventures.github.io/trackkit/)** for:
- [Quick start instructions](https://enkosiventures.github.io/trackkit/overview/quickstart)
- [Comprehensive guides](https://enkosiventures.github.io/trackkit/guides/choosing-provider)
- [Multiple complete example applications](https://enkosiventures.github.io/trackkit/examples/overview)

To run the documentation site locally, run `pnpm docs:dev` and open [`http://localhost:5173`](http://localhost:5173).

## Packages in this monorepo

| Package                   | Path                                 | Status      | Purpose                                                       |
| ------------------------- | ------------------------------------ | ----------- | ------------------------------------------------------------- |
| **Core SDK**              | `packages/trackkit`                  | available   | Provider-agnostic runtime + built-ins (Umami, Plausible, GA4) |
| React wrapper             | `packages/trackkit-react`            | planned     | `<AnalyticsProvider />`, hooks                                |
| Vue wrapper               | `packages/trackkit-vue`              | planned     | Plugin + composables                                          |
| Plugin API                | `packages/trackkit-plugin-api`       | planned     | Adapter interface & dev helpers                               |
| Example plugin            | `packages/trackkit-plugin-amplitude` | planned     | Amplitude adapter (opt-in)                                    |

This repo uses **pnpm workspaces**. All commands below are run from the repository root.

## Core SDK

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

### Gating & Flow

Trackkit sends events only after passing:

**PolicyGate → Consent → Provider readiness → Queue/Offline → Transport**

Every mechanism (SSR, offline, resilience, performance) is downstream of these gates.

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

**Trackkit is consent-aware:** events are queued until consent and provider readiness allow them to be sent, and non-essential analytics follow your configured policy. [All built-in providers](/guides/choosing-provider) allow for consent management.

For full behaviour, see the **[Consent & Privacy](https://enkosiventures.github.io/trackkit/guides/consent-and-privacy)** guide.

### Environment variables

Trackkit reads build-time/public env vars (with common bundler prefixes):

| Var                   | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| `TRACKKIT_PROVIDER`   | default provider (`umami` \| `plausible` \| `ga4` \| `noop`) |
| `TRACKKIT_SITE`       | provider site/measurement ID                                 |
| `TRACKKIT_HOST`       | analytics host (self-host/custom domain)                     |
| `TRACKKIT_QUEUE_SIZE` | max buffered events (default: 50)                            |
| `TRACKKIT_DEBUG`      | `true`/`false`                                               |

For runtime injection and SSR-safe config, see the **[Configuration](https://enkosiventures.github.io/trackkit/reference/configuration)** reference.

**Bundlers:**

* Vite → `VITE_TRACKKIT_*`
* CRA → `REACT_APP_TRACKKIT_*`
* Generic/Node → `TRACKKIT_*`

For Next.js, prefer runtime injection or a small custom loader that passes values into `init` at startup (see `docs/api/configuration.md` for details).

### Multiple Providers

Trackkit supports multiple providers.

See the **[Choosing a Provider](https://enkosiventures.github.io/trackkit/guides/choosing-provider#running-multiple-providers)** guide for more information.

### SSR

Trackkit queues events during server rendering and hydrates them on the client. Server-side calls must use the SSR API (trackkit/ssr); client code hydrates automatically.

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

## Development

### Install dependencies

```bash
pnpm install
```

### Run tests

```bash
pnpm test
pnpm test:coverage    # with coverage
```

### Type checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Build all packages

```bash
pnpm build
```

### Dead code / bundle hygiene

```bash
pnpm deadcode       # full analysis
pnpm deadcode:ci    # ci-mode
pnpm size           # bundle size reports
```

### Documentation (VitePress)

```bash
pnpm docs:dev       # run the docs site locally
pnpm docs:build     # generate static build (docs/.vitepress/dist)
pnpm docs:preview   # preview the production build
```

The documentation site is deployed via GitHub Actions using
`upload-pages-artifact` → `deploy-pages`.

## Release workflow

Publishing a release consists of:

```bash
pnpm release
```

This runs:

* clean
* build
* defaults:inject
* defaults:assert

To build docs API:

```bash
pnpm release:docs
```

NPM publication is handled through the `prepublishOnly` script in the package.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

* repository structure
* development environment
* tests and release rules
* provider guidelines
* PR expectations

## License

MIT © Enkosi Ventures

---
