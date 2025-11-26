# Umami Provider

The Umami adapter sends events to a self-hosted or cloud Umami instance.  
Trackkit loads **no script tags**; all communication is via the Umami HTTP API.


## Features

- Cookieless, privacy-friendly
- Automatic SPA pageviews (`autoTrack: true`)
- Custom events (`analytics.track()`)
- Consent-aware buffer + flush
- Domain allowlist & path exclusion
- DNT respected by default

`identify()` is a no-op (Umami has no concept of user identity).


## Configuration

### Minimal

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'umami',
  site: 'your-website-id',
  // host: 'https://analytics.example.com'  // Required if not using Umami cloud default for your setup
});
```

### Common options

```ts
const analytics = createAnalytics({
  provider: 'umami',
  site: 'your-website-id',
  // website: 'your-website-id',               // Provider-specific alternative to 'site'
  host: 'https://analytics.example.com',       // required for self-host
  autoTrack: true,                             // SPA pageviews
  doNotTrack: true,                            // default: respected if not set to false
  domains: ['example.com', 'www.example.com'], // exact matches
  exclude: ['/admin', '/preview'],             // substring/path checks
  includeHash: false,                          // ignore #fragment by default
  trackLocalhost: true,                        // enable in local dev if desired
  defaultProps: { appVersion: '2.3.1' },       // merged into event props
  debug: false,
});
```

> **Identifier:**
> You may provide either the Umami-specific `website` field or the generic `site` field.

### Environment Variables

```sh
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=your-website-id
TRACKKIT_HOST=https://analytics.example.com
```


## API Usage

> Examples below use singleton helpers for brevity.

### Pageviews

```ts
history.pushState({}, '', '/virtual/thank-you');
pageview(); // must update history first
```

### Custom events

```ts
track('newsletter_signup');
track('purchase', { product: 'T-Shirt', price: 29.99 });
```

### Consent

```ts
denyConsent();
grantConsent();
```


## Limitations

* No user identification.
* Manual pageview does **not** accept a URL argument—use history updates.
* Domain allowlist uses exact string comparison.


## Debugging

```ts
createAnalytics({
  provider: 'umami',
  site: 'your-website-id',
  debug: true,
});
```

See lifecycle logs, send decisions, and de-duplication behaviour.


## Best Practices

* Self-host whenever possible.
* Flatten event props.
* Respect DNT unless explicitly permitted.


## Related Docs

- [Global configuration keys](/api/configuration)
- [Umami CSP guidance](/guides/csp#umami-plausible-no-external-scripts)
