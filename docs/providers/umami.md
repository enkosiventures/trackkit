# Umami Provider

The Umami adapter sends events to a self-hosted or cloud Umami instance.  
Trackkit loads **no script tags**; all communication is via the Umami HTTP API.


## Features

- Cookieless, privacy-friendly
- Automatic SPA pageviews (configurable via `autoTrack`)
- Custom events (`analytics.track()`)
- Consent-aware buffer + flush
- Domain allowlist & path exclusion
- DNT respected by default

`identify()` is currently a no-op (Umami does not track user identity profiles in the same way as Mixpanel/Segment).

## Configuration

### Minimal

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: {
    name: 'umami',
    site: 'your-website-id', // UUID from Umami dashboard
    // host defaults to 'https://api.umami.is' if omitted
  },
});
```

### Common options

```ts
const analytics = createAnalytics({
  provider: {
    name: 'umami',

    // Identifier
    site: 'your-website-id',                     // Unified key
    // website: 'your-website-id',               // Provider-specific alternative to 'site'

    // Endpoint
    host: 'https://analytics.example.com',       // Required for self-hosted instances

    // Metadata
    defaultProps: { appVersion: '2.3.1' },       // Merged into every event
  },

  // Features
  autoTrack: true,                             // Enable SPA pageview tracking
  doNotTrack: true,                            // Respect browser DNT setting
  trackLocalhost: true,                        // Enable in local dev

  // Filtering
  domains: ['example.com', 'www.example.com'], // Exact match allowlist
  exclude: ['/admin', '/preview'],             // Path substring blocklist
  includeHash: false,                          // Ignore URL hash in pageviews

  debug: false,
});
```

### Environment Variables

```sh
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=your-website-id
TRACKKIT_HOST=https://analytics.example.com
```

Or via Vite-style:

```sh
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=your-website-id
VITE_TRACKKIT_HOST=https://analytics.example.com
```


## API Usage

> Examples below use singleton helpers (`pageview`, `track`). You can also call methods on the `analytics` instance.

### Pageviews

```ts
import { pageview } from 'trackkit';

// Manual trigger for current page 
// (if autoTrack is false or for virtual views)
pageview();
// url can be passed as an argument:
pageview('/virtual/thank-you');
```

### Custom events

```ts
import { track } from 'trackkit';

track('newsletter_signup');
track('purchase', { product: 'T-Shirt', price: 29.99 });
```

### Consent

```ts
import { denyConsent, grantConsent } from 'trackkit';

denyConsent(); // Stop sending
grantConsent(); // Flush queue and resume
```


## Limitations

* **User Identification:** `identify()` is not supported.
* Manual pageview does **not** accept a URL argument—use history updates. (NOTE: I don't think this is true...)
* **Exact Match:** Domain allowlist uses exact string comparison.


## Debugging

```ts
createAnalytics({
  provider: { name: 'umami', site: 'your-website-id' },
  debug: true,
});
```

See lifecycle logs, payload construction, and send decisions in the browser console.


## Best Practices

* Self-host whenever possible.
* Flatten event props.
* Respect DNT unless explicitly permitted.


## Related Docs

- [Global configuration keys](/reference/configuration)
- [Umami CSP guidance](/guides/csp#umami-plausible-no-external-scripts)
