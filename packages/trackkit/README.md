# Trackkit Core SDK

> A tiny, privacy-first analytics SDK with built-in support for Umami, Plausible, and Google Analytics. MV3-safe, cookie-less by default, and SSR-friendly.

---

## Install

```bash
npm i trackkit
````

or

```bash
pnpm add trackkit
```

---

## What It Does

* Collects custom events, page views, and identities
* Buffers events until user consent is granted
* Supports **Umami**, **Plausible**, **Google Analytics 4**, and `noop` out of the box
* Plugin-ready (see `trackkit-plugin-api`)
* First-party-hosted, CSP-compliant, and safe in browser extensions

---

## Usage

```ts
import { init, track, pageview, grantConsent } from 'trackkit';

init({
  provider: 'umami',                        // or 'plausible' | 'ga' | 'none'
  site: 'de305d54-75b4-431b-adb2',
  host: 'https://cloud.umami.is'
});

grantConsent();

track('signup_submitted', { plan: 'pro' });
pageview();
```

---

## TypeScript

You can define event types explicitly for autocompletion and validation:

```ts
type MyEvents = {
  'signup_submitted': { plan: string };
  'purchase_completed': { amount: number; currency: string };
};

const analytics = init() as TypedAnalytics<MyEvents>;
analytics.track('signup_submitted', { plan: 'starter' });
```

---

## Environments

| Runtime         | Notes                                           |
| --------------- | ----------------------------------------------- |
| **Browser**     | Consent-aware, no cookies (for Umami/Plausible) |
| **Node/Worker** | Uses `@umami/node` if `provider: 'umami-node'`  |
| **MV3**         | CSP-compatible, does not inject remote scripts  |

---

## Consent

Use `grantConsent / denyConsent` to control event flow. Events are buffered until granted. See [`privacy-compliance.md`](../../docs/guides/privacy-compliance.md).

---

## Configuration

| Option         | Type    | Default  | Description                             |             |      |          |
| -------------- | ------- | -------- | --------------------------------------- | ----------- | ---- | -------- |
| `provider`     | string  | `'none'` | \`'umami'                               | 'plausible' | 'ga' | 'none'\` |
| `site`       | string  | –        | ID from provider                        |             |      |          |
| `host`         | string  | –        | Custom analytics host (if self-hosted)  |             |      |          |
| `debug`        | boolean | `false`  | Logs queue state and events             |             |      |          |
| `queueSize`    | number  | `50`     | Max buffer before dropping              |             |      |          |
| `batchSize`    | number  | `10`     | (Future) events per flush batch         |             |      |          |
| `batchTimeout` | number  | `1000`   | (Future) ms before flush timer triggers |             |      |          |

---

## Bundle Size

| Target            | Gzipped Size |
| ----------------- | ------------ |
| Core (no adapter) | \~2.5 kB     |
| With Umami        | \~4.0 kB     |
| With Plausible    | \~5.0 kB     |

---

## Examples

See the [examples/](../../examples) directory for:

* Vite-based SPA demo
* Chrome MV3 extension demo

---

## 🧩 Want Amplitude, PostHog, or Mixpanel?

Install a plug-in provider using [`trackkit-plugin-api`](https://www.npmjs.com/package/trackkit-plugin-api):

```ts
import { registerProvider, init } from 'trackkit';
import amp from 'trackkit-plugin-amplitude';

registerProvider(amp);
init({ provider: 'amplitude', site: YOUR_KEY });
```

---

## License

MIT © Enkosi Ventures

---
