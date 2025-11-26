# Quickstart

Trackkit is a tiny, privacy-first analytics SDK with built-in adapters for **Umami**, **Plausible**, and **GA4**, plus a `noop` adapter for local development.

This guide walks through getting a single-provider setup running using the **factory (instance) API**.


## Install

```bash
npm i trackkit
# or: pnpm add trackkit  /  yarn add trackkit
```


## Create an analytics instance

Create a single `analytics` instance near your app entry point:

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'umami',                 // 'umami' | 'plausible' | 'ga4' | 'noop'
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://cloud.umami.is',    // required if self-hosting / custom domain
  debug: process.env.NODE_ENV === 'development',
});
```

Then import and reuse that instance wherever you need to track:

```ts
// main.tsx
import { analytics } from './analytics';

analytics.pageview(); // initial load
```

Under the hood, the instance will:

* Lazy-load the provider adapter.
* Queue events while the provider/consent isn’t ready.
* Respect consent, domain rules, DNT, and localhost settings.


## Track page views and events

### Page views

```ts
import { analytics } from './analytics';

// infer URL from window.location
analytics.pageview();

// or pass an explicit URL (useful for SPAs / routers)
analytics.pageview('/pricing');
```

### Custom events

```ts
analytics.track('signup_submitted', {
  plan: 'starter',
  source: 'hero_cta',
});
```

### Identify (where supported)

```ts
analytics.identify('user_123'); // Provider support varies; unsupported calls are safe no-ops
```


## Consent-aware behavior

By default, Trackkit treats analytics as **non-essential** and will respect your consent configuration.

A common EU-style setup:

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  consent: {
    initialStatus: 'pending',      // 'pending' | 'granted' | 'denied'
    requireExplicit: true,         // explicit opt-in
    allowEssentialOnDenied: false, // no “essential” calls once denied
  },
});
```

In your banner code:

```ts
import { analytics } from './analytics';

acceptButton.onclick = () => analytics.grantConsent();
rejectButton.onclick = () => analytics.denyConsent();
```

Behavior:

* **pending** → events queue in memory.
* **granted** → queue flushes; new events send immediately.
* **denied** → non-essential events are dropped; optional “essential” calls depend on `allowEssentialOnDenied`.

For more patterns (policy versions, CMP integration, SSR), see the **Consent Management** guide.


## Singleton helpers

Trackkit exposes **two ways** to talk to the analytics facade:

- `createAnalytics(opts?)` → returns an **instance**.
- Top-level helpers (`init`, `track`, `pageview`, `grantConsent`, …) → operate on a **process-wide singleton**.

Most apps should prefer **instances**:

- You can scope analytics to a particular app, tab, widget, or test.
- It’s easier to reason about SSR, multi-tenant setups, and tests.
- You avoid hidden global state.

However, if you prefer a global singleton, you can use the top-level helpers:

```ts
import {
  init, destroy,
  track, pageview, identify,
  setConsent, grantConsent, denyConsent, resetConsent,
  waitForReady, hasQueuedEvents, flushIfReady,
  getConsent, getDiagnostics,
} from 'trackkit';

init({
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
});

pageview();
track('signup_submitted', { plan: 'starter' });

// later:
grantConsent();
```

Internally this uses the same core as the instance API. For larger apps, SSR, and multi-provider setups, the **instance API** is usually easier to reason about.

The singleton is convenient for:

* Very small apps with a single analytics configuration.
* Legacy code or places where passing an instance around is awkward.

You **should not mix styles within the same slice of code** (e.g. calling `track()` and `analytics.track()` against different configs). Pick one style per app/entry point and stick to it.


## Debugging & diagnostics

Enable debug logs to see what Trackkit is doing:

```ts
const analytics = createAnalytics({
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  debug: true,
});
```

At runtime you can inspect consent and queue state:

```ts
console.log(analytics.getConsent());      // status, queued/dropped
console.log(analytics.getDiagnostics());  // provider state, queue sizes, etc.
```

If you want to wire Trackkit into your own logging:

```ts
const analytics = createAnalytics({
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  onError: (err) => {
    // err is an AnalyticsError with .code, .message, .provider, .timestamp
    myLogger.error('analytics_error', err);
  },
});
```


## Next steps

- Understand provider-specific options: [Configuration](/reference/configuration)
- Learn how consent and queueing interact: 
  - [Consent & Privacy](/guides/consent-and-privacy)
  - [Queue Management](/guides/queue-management)
- Explore guides for different providers:
  - [Umami](/providers/umami)
  - [Plausible](/providers/plausible)
  - [Google Analytics 4](/providers/ga4)
- See full SSR semantics: [SSR Guide](/guides/ssr)
