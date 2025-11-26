# Trackkit Core SDK

> Privacy-first analytics facade for modern web apps.

Trackkit provides a single, typed API for sending analytics events to:
- **Umami**
- **Plausible**
- **GA4 (Measurement Protocol only — no gtag.js)**
- **Custom providers**

It requires **no remote scripts**, supports **SSR hydration**, **consent gating**, **queue-first delivery**, and **CSP-friendly transports**.

**[View the full documentation site here.](https://enkosiventures.github.io/trackkit/)**

## At a glance

* **Adapters built-in**: `umami`, `plausible`, `ga4`, plus `noop`.
* **No script tags**: everything ships inside your bundle; CSP/MV3 friendly.
* **Consent-aware**: queue or block events until you say go.
* **Queue + overflow**: in-memory buffer with overflow signaling.
* **SSR**: collect on the server, hydrate & replay on the client.
* **Typed DX**: optional event typing and provider types.

## Install

```bash
npm install trackkit
# or
pnpm add trackkit
# or
yarn add trackkit
```

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

## SSR

Trackkit ships a dedicated SSR entry:

```ts
import { ssrTrack } from 'trackkit/ssr';

export function render() {
  ssrTrack('pageview', { url: '/home' });
}
```

SSR events are serialised into the page and hydrated into the client runtime
queue exactly once.

See the **[full SSR documentation](https://enkosiventures.github.io/trackkit/guides/ssr)** for complete guidance.

## Built-in Provider specifics

* **Umami**: cookieless; self-host friendly (`host` required when not using cloud). `identify()` is implemented as a no-op for compatibility with the facade.
* **Plausible**: cookieless; goals & revenue support; 5-minute dashboard delay typical.
* **GA4**: consent-sensitive; supports identify via `user_id`; optional `apiSecret` for Measurement Protocol.

All providers follow Trackkit’s gating rules (**PolicyGate → Consent → Provider** readiness). Provider-specific behaviour applies after that.

See the **[Provider Guides](https://enkosiventures.github.io/trackkit/providers/umami)** for complete details.

## Migrating from existing tracking snippets

Trackkit provides comprehensive migration guides for:

* **[GA4 (from gtag.js)](https://enkosiventures.github.io/trackkit/migration/from-ga4)**
* **[Plausible script](https://enkosiventures.github.io/trackkit/migration/from-plausible)**
* **[Umami script](https://enkosiventures.github.io/trackkit/migration/from-umami)**

## License

MIT © Enkosi Ventures
