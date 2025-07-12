# **Root README `trackkit/`**

```txt
TrackKit – tiny, privacy-first telemetry for the modern web
───────────────────────────────────────────────────────────
Core SDK   •   React & Vue wrappers   •   Plug-in ecosystem
MV3-safe   •   <6 kB browser bundle   •   No remote scripts
```

## Why TrackKit?

* **Minimal blast-radius** – page-view + custom events in 6 kB.
* **Cookie-less by default** – no banner needed for Umami & Plausible.
* **Plug-in architecture** – bolt on heavier providers (Amplitude, PostHog) when you *need* cohorts & pathing.
* **Runs everywhere** – React / Vue, service-workers, Node, Cloudflare Workers, Chrome extensions (MV3).
* **Server-side Rendering (SSR)** – Built-in support for SSR environments.
* **Multi-provider Analytics** – Flexible architecture supports multiple providers simultaneously (e.g., mirroring critical events).

## Packages in this monorepo

| Package             | NPM scope                   | Purpose                                                       |
| ------------------- | --------------------------- | ------------------------------------------------------------- |
| **Core**            | `trackkit`                  | Provider-agnostic runtime & built-ins (Umami, Plausible, GA4) |
| **React wrapper**   | `trackkit-react`            | `<AnalyticsProvider/>`, `useAnalytics` & `usePageview`        |
| **Vue wrapper**     | `trackkit-vue`              | `AnalyticsPlugin`, `useAnalytics`, `usePageview`              |
| **Plug-in API**     | `trackkit-plugin-api`       | `ProviderAdapter` interface + dev helpers                     |
| **Example plug-in** | `trackkit-plugin-amplitude` | Amplitude v9 adapter (opt-in, 30 kB)                          |

*(All packages are MIT-licensed.)*

### Detailed Package Docs

- [Trackkit Core](./packages/trackkit/README.md)
- [React Wrapper](./packages/trackkit-react/README.md)
- [Vue Wrapper](./packages/trackkit-vue/README.md)
- [Plug-in API](./packages/trackkit-plugin-api/README.md)
- [Amplitude Plugin](./packages/trackkit-plugin-amplitude/README.md)


## Quick start – core

```bash
npm i trackkit            # or pnpm add trackkit
```

```ts
import { init, track } from 'trackkit';

init({
  provider:  'umami',                     // 'plausible' | 'ga' | 'none'
  siteId:    'de305d54-75b4-431b-adb2',
  host:      'https://cloud.umami.is'     // optional
});

track('cta_clicked', { plan:'pro' });
```

### Chrome-extension CSP

```jsonc
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' \
    https://cloud.umami.is \
    https://plausible.io \
    https://www.google-analytics.com \
    https://api2.amplitude.com \
    https://regionconfig.amplitude.com"
}
```

*Adjust depending on used providers*

Full API & env-var matrix → [`packages/trackkit/README.md`](packages/trackkit/README.md).

## Adding a heavy provider (Amplitude example)

```bash
npm i trackkit-plugin-amplitude amplitude-js
```

```ts
import amp from 'trackkit-plugin-amplitude';
import { registerProvider, init } from 'trackkit';

registerProvider(amp);                   // one line
init({ provider:'amplitude', siteId:AMP_KEY, host:'https://api2.amplitude.com'});
```

## Repository structure

```
packages/
  trackkit/                 core
  trackkit-react/           react wrapper
  trackkit-vue/             vue wrapper
  trackkit-plugin-api/      adapter interface & helpers
  trackkit-plugin-amplitude/ example plug-in
examples/
  vite-site/                demo SPA
  mv3-extension/            demo Chrome extension
```

### Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `pnpm build`        | tsup → rollup – builds all packages |
| `pnpm test`         | vitest unit suites + size-limit     |
| `pnpm size`         | gzip size report for every artefact |
| `pnpm lint`         | eslint + prettier                   |
| `pnpm example:site` | run Vite demo                       |
| `pnpm example:ext`  | build & launch MV3 CRX in Chromium  |

CI -- GitHub Actions matrix: Node 18/20; Playwright e2e for SPA + extension; size-limit gate (core ≤ 6 kB, each plug-in ≤ 35 kB).

## Contributing

1. `pnpm i`
2. `pnpm dev` (watches all packages)
3. Keep bundle budgets green (`pnpm size`).
4. Commit style: **Conventional Commits**.
5. New provider? `pnpm dlx trackkit-plugin-api new-plugin posthog`.

## Licence

MIT © Enkosi Ventures

---

# **Core README `packages/trackkit/`**

## TrackKit (core)

| Feature      | Detail                                              |
| ------------ | --------------------------------------------------- |
| Bundle       | **5.7 kB** (Umami/Plausible/GA built-ins)           |
| Runtimes     | Browser, service-worker, Node, CF Worker            |
| MV3 safe     | No remote scripts, HSTS respect                     |
| Consent hook | `setConsent('granted' \| 'denied')` (GA / plug-ins) |

### Install

```bash
npm i trackkit
```

### Init

```ts
init({
  provider:   'plausible',             // 'umami' | 'ga' | 'none'
  siteId:     'trackkit.dev',          // plausible: domain
  host:       'https://plausible.io',  // correct host for given provider
  queueSize:  50
});
```

### API

| Function                    | Notes                              |
| --------------------------- | ---------------------------------- |
| `track(name, props?, url?)` | Custom event                       |
| `pageview(url?)`            | Auto-default = `location.pathname` |
| `identify(userId)`          | `null` clears                      |
| `setConsent(state)`         | GA / plug-in aware                 |

### Environment variables

| Var                 | Example | Purpose            |
| ------------------- | ------- | ------------------ |
| `TRACKKIT_PROVIDER` | `umami` | Build-time default |
| `TRACKKIT_SITE_ID`  | UUID    | —                  |
| `TRACKKIT_HOST`     | url     | —                  |
| `TRACKKIT_QUEUE`    | `50`    | Buffer length      |

### CSP cheatsheet

```jsonc
"connect-src": [
  "'self'",
  "https://cloud.umami.is",
  "https://plausible.io",
  "https://www.google-analytics.com"
]
```

### Size limits

* Browser build: **≤ 6 kB** gzip
* Worker build (incl. @umami/node): **≤ 20 kB**

CI fails if budgets exceeded.

---
