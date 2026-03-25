# Trackkit Core SDK

> Privacy-first analytics facade for modern web apps.

Trackkit provides a single, typed API for sending analytics events to:
- **Umami**
- **Plausible**
- **GA4 (Measurement Protocol only — no gtag.js)**
- **Custom providers**

It requires **no remote scripts**, supports **SSR hydration**, **consent gating**, **queue-first delivery**, and **CSP-friendly transports**.

**[View the full documentation site here.](https://trackkit.enkosiventures.com/)**

## Install

```bash
npm install trackkit
# or
pnpm add trackkit
# or
yarn add trackkit
```

~18kb core (minified + brotli). Adapters are tree-shakeable — only the one you use is bundled.

## Usage

Trackkit exposes a small facade API with both instance and singleton usage styles.

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: { name: 'umami', site: 'your-site-id' },
});

analytics.pageview();
analytics.track('signup_submitted', { plan: 'starter' });
```

For full documentation, see the **Quickstart**, detailed guides, API reference, and example applications on the **[Trackkit docs site](https://trackkit.enkosiventures.com)**.

## TypeScript niceties

Define an event map and pass it as a type parameter to `createAnalytics` for
compile-time checking of `track()` calls:

```ts
import { createAnalytics } from 'trackkit';

type MyEvents = {
  signup_submitted: { plan: 'free' | 'pro' };
  purchase_completed: { amount: number; currency: string };
};

const analytics = createAnalytics<MyEvents>({
  provider: { name: 'umami', site: '...' },
});

analytics.track('signup_submitted', { plan: 'pro' });     // ✅ compiles
analytics.track('signup_submitted', { plan: 'gold' });     // ❌ type error
analytics.track('signup_submited');                         // ❌ typo caught
```

When no type parameter is supplied, behaviour is unchanged — any event name
and any props are accepted.

> **Note:** The singleton API (`init` / `track`) does not support typed events.
> Use the factory API (`createAnalytics<E>()`) for compile-time event checking.

## SSR

Trackkit ships a dedicated SSR entry:

```ts
import { ssrPageview } from 'trackkit/ssr';

export function render() {
  ssrPageview('/home');
}
```

SSR events are serialised into the page and hydrated into the client runtime
queue exactly once.

See the **[full SSR documentation](https://trackkit.enkosiventures.com/guides/ssr)** for complete guidance.

## Built-in Provider specifics

* **Umami**: cookieless; self-host friendly (`host` required when not using cloud). `identify()` is implemented as a no-op for compatibility with the facade.
* **Plausible**: cookieless; goals & revenue support.
* **GA4**: consent-sensitive; supports identify via `user_id`; optional `apiSecret` for Measurement Protocol.

All providers follow Trackkit’s gating rules (**PolicyGate → Consent → Provider** readiness). Provider-specific behaviour applies after that.

See the **[Provider Guides](https://trackkit.enkosiventures.com/guides/providers/umami)** for complete details.

## Migrating from existing tracking snippets

Trackkit provides comprehensive migration guides for:

* **[GA4 (from gtag.js)](https://trackkit.enkosiventures.com/guides/migration/from-ga4)**
* **[Plausible script](https://trackkit.enkosiventures.com/guides/migration/from-plausible)**
* **[Umami script](https://trackkit.enkosiventures.com/guides/migration/from-umami)**

## License

MIT © Enkosi Ventures
