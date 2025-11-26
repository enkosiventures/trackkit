# Google Analytics 4 (GA4) Provider

The GA4 adapter in Trackkit provides a lightweight client for GA4 without requiring the `gtag.js` snippet. It handles queueing, consent gating, SPA navigation, and stable event dispatch.

Trackkit **does not** load GA4’s external script unless explicitly configured through the provider’s advanced options.

Trackkit’s GA4 adapter is Measurement-Protocol–only. No GA script is loaded unless you explicitly load it yourself.

## Features

- Automatic SPA pageviews (`autoTrack: true` by default)
- Custom events via `analytics.track()`
- Optional identification (`analytics.identify()`)
- Consent-aware queueing and replay
- Domain allowlist (`domains`) and path exclusion (`exclude`)
- Debug logging for lifecycle and send decisions


## Configuration

### Minimal

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX', 
});
```

### Common options

```ts
const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  // measurementId: 'G-XXXXXXXXXX',      // Provider-specific alternative to 'site'
  autoTrack: true,                       // SPA pageviews
  doNotTrack: true,                      // respect DNT
  includeHash: false,                    // omit #fragment
  domains: ['example.com'],              // optional allowlist
  exclude: ['/admin', '/preview'],       // skip certain paths
  trackLocalhost: true,                  // enabled by default
  defaultProps: { appVersion: '2.3.1' }, // merged into GA4 params
  debug: false,
});
```

> **Identifier:**
> You may provide either the GA4-specific `measurementId` field or the generic `site` field.

### Environment Variables

```sh
TRACKKIT_PROVIDER=ga4
TRACKKIT_SITE=G-XXXXXXXXXX
TRACKKIT_DEBUG=false
```

Or via Vite-style:

```sh
VITE_TRACKKIT_PROVIDER=ga4
VITE_TRACKKIT_SITE=G-XXXXXXXXXX
```


## API Usage

> Examples below use the **singleton helpers** (`track`, `pageview`, `identify`,…) for compactness.
> To use instances instead, call the same methods on your `analytics` object.

### Pageviews

```ts
import { pageview } from 'trackkit';

history.pushState({}, '', '/thank-you');
pageview(); // current URL
```

Automatic when `autoTrack: true`.

### Custom Events

```ts
import { track } from 'trackkit';

track('purchase', {
  value: 29.99,
  currency: 'USD',
  items: [
    { item_id: 'SKU123', item_name: 'T-Shirt', price: 29.99, quantity: 1 }
  ]
});
```

### Identify

```ts
import { identify } from 'trackkit';

identify('user-123'); // sets GA4 user_id
```

### Consent

```ts
import { grantConsent, denyConsent } from 'trackkit';

denyConsent();  // optional initial state
grantConsent(); // queued events flush
```


## CSP

Because Trackkit sends GA4 hits directly (Measurement Protocol), you typically need only:

```
connect-src https://www.google-analytics.com https://region1.google-analytics.com;
```

No script tag required unless using an advanced GA4 configuration.


## Notes & Limitations

* `identify()` sets only the GA4 `user_id`; it does not touch GA cookies.
* GA4 may still set cookies if your property is configured to do so. These cookies are set by GA4 server infrastructure based on property settings, not by Trackkit.
* Domain/exclusion filters are string-based (no wildcards).
* For server-side Measurement Protocol, set `apiSecret` in provider options.


## Debugging

```ts
const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  debug: true,
});
```

You’ll see:

* Provider readiness
* Queue adds/replays
* Navigation triggers
* URL normalization decisions


## Best Practices

1. Ensure a compliant consent flow.
2. Use `defaultProps` for application metadata.
3. Keep GA4 event names aligned with recommended GA4 semantics.
4. Consider using a proxy if you want full first-party deployment.


## Related Docs

- [Global configuration keys](/reference/configuration)
- [GA4 CSP guidance](/guides/csp#google-analytics-4-loads-gtag-js)
