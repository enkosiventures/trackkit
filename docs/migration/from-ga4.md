# Migrating from Google Analytics 4 (gtag) to Trackkit

This guide helps you replace gtag-based GA4 with Trackkit’s GA4 provider.

## Before: gtag / dataLayer

```html
<!-- gtag.js -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');

  // Custom events
  gtag('event', 'purchase', {
    value: 29.99,
    currency: 'USD',
    items: [{ item_id: 'SKU-123', item_name: 'T-Shirt', price: 29.99, quantity: 1 }],
  });
</script>
```

## After: Trackkit

### Installation

```bash
npm install trackkit
```

### Environment Configuration

```bash
# .env
VITE_TRACKKIT_PROVIDER=ga
VITE_TRACKKIT_SITE=G-XXXXXXXXXX
# Optional Measurement Protocol secret (server/SSR usage)
# VITE_TRACKKIT_API_SECRET=YOUR_MP_SECRET
```

### Code Changes

```ts
import { init, track } from 'trackkit';

// Initialize (typically once)
init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  // apiSecret: 'YOUR_MP_SECRET', // optional for Measurement Protocol server-side
});

// Same events, simpler API
track('purchase', {
  value: 29.99,
  currency: 'USD',
  items: [{ item_id: 'SKU-123', item_name: 'T-Shirt', price: 29.99, quantity: 1 }],
});
```

## Key Differences

### 1) No gtag/dataLayer globals

* ✅ No extra script tag
* ✅ Fewer CSP headaches
* ✅ Easier to type-check and test

### 2) Consent Handling

```ts
import { init, setConsent } from 'trackkit';

init({ consent: { initial: 'pending', requireExplicit: true } });

// After user grants
setConsent('granted');
```

> In the EU, GA4 generally requires consent before sending. Trackkit won’t send until consent is granted if you configure it this way.

### 3) TypeScript & Developer UX

```ts
track('add_to_cart', {
  currency: 'USD',
  value: 19.99,
  items: [{ item_id: 'SKU-456', item_name: 'Hat', price: 19.99, quantity: 1 }],
});
```

### 4) SPA Support Out of the Box

* Automatic History API tracking
* Proper referrer management
* Optional `includeHash`

### 5) Error Handling

```ts
init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  onError: (err) => {
    // Pipe to your logging
    console.error('Analytics error', err);
  }
});
```

## Advanced Migration

### Server-Side / Measurement Protocol

```ts
// Add API secret (MP) to enable server-side event delivery when needed
init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  apiSecret: 'YOUR_MP_SECRET',
});
```

### Custom Dimensions & Metrics

```ts
init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  customDimensions: { plan_type: 'dimension1' },
  customMetrics: { lifetime_value: 'metric1' },
});

track('upgrade', {
  plan_type: 'pro',        // → dimension1
  lifetime_value: 1234.56, // → metric1
});
```

### Consent Mode Equivalents

If you previously used:

```js
gtag('consent', 'default', { analytics_storage: 'denied' });
gtag('consent', 'update',  { analytics_storage: 'granted' });
```

Use Trackkit:

```ts
import { setConsent } from 'trackkit';
setConsent('denied');
setConsent('granted');
```

## Testing Your Migration

1. **Run Trackkit in parallel** for a short period; compare GA4 Realtime.
2. **Use debug mode** to see payload validation feedback.
3. **Verify conversion events** and e-commerce parameters.

## Common Issues

### Events Not Appearing

* Check `site` is a GA4 Measurement ID (`G-…`)
* Confirm consent status `granted`
* Enable `debug: true` and watch console
* Check network requests in DevTools

### Missing User ID

```ts
import { identify } from 'trackkit';
identify('user-123'); // Sets GA4 user_id for subsequent events
```

### Metric Differences

Some counts may differ due to:

* Different SPA/pageview semantics
* Better debouncing of duplicate navigations
* Stricter consent gating

## CSP

If you previously allowed `www.googletagmanager.com`, you can simplify:

```
connect-src 'self' https://www.google-analytics.com;
```

(No script tag needed when using Trackkit.)

## Rollback Plan

Keep a feature flag:

```ts
const useTrackkit = location.search.includes('use-trackkit');

if (useTrackkit) {
  import('trackkit').then(({ init }) => init({ provider: 'ga', site: 'G-XXXXXXXXXX' }));
} else {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX';
  document.head.appendChild(s);
  // plus your legacy gtag bootstrap
}
```
