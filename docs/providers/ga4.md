# Google Analytics 4 (GA4) Provider

The GA4 adapter in Trackkit provides a lightweight client for GA4 without requiring the `gtag.js` snippet. It handles queueing, consent gating, SPA navigation, and stable event dispatch.

Trackkit **does not** load GA4’s external script unless explicitly configured through the provider’s advanced options.

Trackkit’s GA4 adapter is Measurement-Protocol–only. No GA script is loaded unless you explicitly load it yourself.

## Features

- **No external scripts** (0kB remote dependency).
- Automatic SPA pageviews (via `autoTrack`)
- Automatic `client_id` and `session_id` management.
- Custom events & user properties
- Consent-aware queueing and replay


## Configuration

### Minimal

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',  // Your Measurement ID

  // Recommended for full reporting accuracy in MP:
  // apiSecret: '...', 
});
```

### Common options

```ts
const analytics = createAnalytics({
  provider: 'ga4',

  /* Identifier */
  site: 'G-XXXXXXXXXX',
  // measurementId: 'G-XXXXXXXXXX',      // Provider-specific alternative to 'site'

  /* Auth (Optional but recommended for reliability) */
  apiSecret: 'YOUR_API_SECRET',          // Generated in GA4 Admin > Data Streams > API Secrets

  /* Features */
  autoTrack: true,                       // SPA pageviews
  defaultProps: { appVersion: '2.3.1' }, // merged into GA4 params
  includeHash: false,                    // omit #fragment
  trackLocalhost: true,                  // enabled by default

  /* Filtering */
  doNotTrack: true,                      // respect DNT
  domains: ['example.com'],              // optional allowlist
  exclude: ['/admin', '/preview'],       // skip certain paths

  debug: false,
});
```

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

> Examples below use singleton helpers (`pageview`, `track`, `identify`). You can also call methods on the `analytics` instance.

### Pageviews

Unline `gtag.js`, the Measurement Protocol does not automatically detect "page_view" events. Trackkit handles this translation for you.

```ts
import { pageview } from 'trackkit';

// Manual trigger for current page 
// (if autoTrack is false or for virtual views)
pageview();
// url can be passed as an argument:
pageview('/virtual/thank-you');
```


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

// Sets the 'user_id' parameter on all subsequent events
identify('user-123'); 

// Note: To set specific User Properties, pass them as traits (if supported by your setup)
// or simply send them as params on specific events.
```

### Consent

```ts
import { grantConsent, denyConsent } from 'trackkit';

denyConsent();  // optional initial state
grantConsent(); // queued events flush
```

## Session Management

Since Trackkit uses the Measurement Protocol, it manually generates and persists:

1.  `client_id`: A pseudo-unique device ID (persisted in localStorage).
2.  `session_id`: A timestamp-based ID kept in session storage.

This ensures your GA4 dashboard correctly shows "Active Users" and session duration, mirroring `gtag.js` behavior without the bloat.


## CSP

Because Trackkit sends GA4 hits directly (Measurement Protocol), you typically only need to allow the Google Analytics endpoints in your CSP:

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

Enable `debug: true` to see:
* The generated `client_id` and `session_id`.
* The raw payload sent to `/mp/collect`.
* Validation errors (if `debug_mode` param is enabled internally).


## Best Practices

1. Ensure a compliant consent flow.
2. Use `defaultProps` for application metadata.
3. Keep GA4 event names aligned with recommended GA4 semantics.
4. Consider using a proxy if you want full first-party deployment.


## Related Docs

- [Global configuration keys](/reference/configuration)
- [GA4 CSP guidance](/guides/csp#google-analytics-4-loads-gtag-js)
