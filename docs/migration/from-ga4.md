# Migrating from Google Analytics 4 (gtag.js)

This guide is for teams currently using the **GA4 script snippet** and the global `gtag()` function who want to move to **Trackkit’s GA4 provider**.

Trackkit replaces:

- The `<script src="https://www.googletagmanager.com/gtag/js?...">` tag
- The global `gtag()` calls

with a **typed, consent-aware façade**:

- Centralised config
- Built-in queueing and consent gating
- Optional SSR support
- Debuggable, testable code instead of inline script soup


## Conceptual mapping

| Old (GA4)                             | Trackkit equivalent                                            |
|--------------------------------------|----------------------------------------------------------------|
| Global `gtag()` function             | `track()`, `pageview()`, `identify()` helpers or instance API |
| `gtag('config', 'G-XXXX')`           | `createAnalytics({ provider: 'ga4', site: 'G-XXXX' })`        |
| `gtag('event', 'purchase', params)`  | `track('purchase', params)`                                   |
| Script tag in `<head>`               | Env vars + app bootstrap                                      |
| Consent logic around `gtag()`        | `consent.initialStatus`, `grantConsent()`, `denyConsent()`    |
| Route changes + manual `gtag()`      | `autoTrack` + history changes + `domains`/`exclude`           |


## Step 0: Remove the GA snippet

Typical GA4 integration:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }

  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');

  gtag('event', 'purchase', { value: 29.99 });
</script>
```

You’ll be removing both the script tag and the inline `gtag()` calls once the migration is complete. For now, you can keep them behind a feature flag while validating Trackkit.


## Step 1: Install Trackkit

```sh
npm install trackkit
# or
pnpm add trackkit
```


## Step 2: Configure Trackkit (GA4)

### 2.1 Env vars

Add:

```sh
TRACKKIT_PROVIDER=ga4
TRACKKIT_SITE=G-XXXXXXXXXX
TRACKKIT_DEBUG=false
```

You can also use `VITE_TRACKKIT_*` or `REACT_APP_TRACKKIT_*` variants depending on your setup.

### 2.2 Bootstrap code

Create a small module, e.g. `analytics.ts`:

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',     // Measurement ID
  autoTrack: true,          // SPA pageviews
  doNotTrack: true,         // respect DNT
  trackLocalhost: true,     // keep DX-friendly
  includeHash: false,
  debug: false,
});
```

Use this instance throughout your app:

```ts
// somewhere in your app
import { analytics } from './analytics';

analytics.track('purchase', { value: 29.99 });
```

If you prefer singleton helpers:

```ts
import { track } from 'trackkit';
track('purchase', { value: 29.99 });
```

The behaviour is the same; the instance approach makes testability and isolation easier.


## Step 3: Replace GA4 config and pageviews

### 3.1 Config

This:

```js
gtag('config', 'G-XXXXXXXXXX');
```

becomes the `createAnalytics` call from above. No additional “config” calls are required; Trackkit holds config in the façade.

### 3.2 Pageviews

If you were explicitly calling pageviews, e.g.:

```js
gtag('event', 'page_view', { page_path: '/thank-you' });
```

Trackkit equivalent:

```ts
import { pageview } from 'trackkit';

// after pushing a new history entry:
history.pushState({}, '', '/thank-you');
pageview();          // current URL
// or
pageview('/thank-you'); // explicit override
```

Most apps can rely on `autoTrack: true` and not call `pageview()` manually except for more exotic routing setups.


## Step 4: Replace custom events

Typical GA4 event:

```js
gtag('event', 'purchase', {
  value: 29.99,
  currency: 'USD',
  items: [{ item_id: 'SKU123', item_name: 'T-Shirt', price: 29.99 }]
});
```

Trackkit:

```ts
import { track } from 'trackkit';

track('purchase', {
  value: 29.99,
  currency: 'USD',
  items: [{ item_id: 'SKU123', item_name: 'T-Shirt', price: 29.99 }],
});
```

Trackkit passes these through to GA4’s Measurement Protocol adapter. Keep event names/params aligned with GA4’s recommendations to preserve reporting.


## Step 5: Consent & privacy

Instead of conditionally calling `gtag()`, let Trackkit own the queue and gate sends by consent state.

Example:

```ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  consent: {
    initialStatus: 'pending',
    requireExplicit: true,
  },
});
```

In your CMP or consent UI:

```ts
import { analytics } from './analytics';

function onUserConsentGranted() {
  analytics.grantConsent();   // replays queued events
}

function onUserConsentDenied() {
  analytics.denyConsent();    // flushes + blocks further sends
}
```

Trackkit will:

* Queue events while consent is `pending`.
* Drop/avoid sending events when consent is `denied`.
* Respect DNT when `doNotTrack: true`.


## Step 6: SPA & SSR considerations

### SPA

With `autoTrack: true`, Trackkit listens for history changes and `popstate`:

* Pageviews are sent when the URL changes and passes your `domains`/`exclude` rules.
* Duplicate same-URL hits are de-duplicated.

If you previously manually called `gtag()` on route changes, you can remove those once `autoTrack` is verified.

### SSR (optional)

If you do SSR and want server-side events:

```ts
// server
import { ssrTrack, serializeSSRQueue } from 'trackkit/ssr';

ssrTrack('server_render', { route: req.path });
head += serializeSSRQueue(); // injects <script>window.__TRACKKIT_SSR_QUEUE__=...</script>
```

On the client, your usual `createAnalytics` call will hydrate and replay the SSR queue when consent allows.


## Step 7: Validation checklist

Before removing the GA4 snippet:

1. Enable `debug: true` in Trackkit config in a test environment.
2. Navigate through core flows and verify:

   * Pageviews are sent on navigations.
   * Key events (signup, purchase, etc.) appear in GA4 Realtime.
3. Compare old GA4 vs Trackkit in parallel (behind a feature flag) for a small period.
4. Once satisfied, remove the GA4 `<script>` tags and inline `gtag()` calls.


## Rollback strategy

Keep a simple flag to toggle between GA4 snippet and Trackkit while you test:

```ts
const useTrackkit = location.search.includes('use-trackkit');

if (useTrackkit) {
  import('trackkit').then(({ createAnalytics }) => {
    createAnalytics({ provider: 'ga4', site: 'G-XXXXXXXXXX' });
  });
} else {
  // leave gtag.js setup in place
}
```

Once you trust Trackkit, remove the old path entirely.
