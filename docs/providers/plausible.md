# Plausible Provider

The Plausible provider sends analytics to Plausible Cloud or self-hosted servers.  
No external script is loaded—Trackkit dispatches events directly to the Plausible API.


## Features

- Cookieless, privacy-friendly
- Automatic SPA pageviews (`autoTrack: true` default)
- Custom events (`analytics.track()`)
- Consent-aware buffering and replay
- Domain allowlist & path exclusion
- DNT respected by default

`identify()` is a no-op in this adapter (Plausible does not support user identification).


## Configuration

### Minimal

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
});
```

### Common options

```ts
const analytics = createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
  // domain: 'yourdomain.com',           // Provider-specific alternative to 'site'
  host: 'https://plausible.io',          // or self-host  
  autoTrack: true,                       // History API + popstate
  doNotTrack: true,                      // default respected unless set to false
  includeHash: false,                    // ignore #fragment by default
  domains: ['yourdomain.com'],           // exact matches (no wildcards)
  exclude: ['/admin', '/preview'],       // substring/path checks (strings only)
  trackLocalhost: true,                  // enable for local dev if desired
  defaultProps: { appVersion: '2.3.1' }, // merged into event props
  debug: false,
});
```

> **Identifier:**
> You may provide either the Plausible-specific `domain` field or the generic `site` field.

### Environment Variables

```sh
TRACKKIT_PROVIDER=plausible
TRACKKIT_SITE=yourdomain.com
TRACKKIT_HOST=https://plausible.io
```

Or Vite-style equivalents.


## API Usage

> Examples below use **singleton helpers** (`track`, `pageview`).
> With an instance, call `analytics.track()` etc.

### Pageviews

```ts
history.pushState({}, '', '/thank-you');
pageview();
```

### Custom events

```ts
track('Signup', { plan: 'Pro' });
track('Purchase', { value: 49.99, currency: 'USD' });
```

Plausible expects flat key/value pairs; Trackkit stringifies non-primitives.

### Consent

```ts
denyConsent();       // or pending by default
grantConsent();      // replays queued events
```


## Notes & Limitations

* No user identification (adapter no-op).
* Domain allowlist uses exact string matching.
* Nested objects in props are ignored by Plausible.


## Debugging

```ts
createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
  debug: true,
});
```


## Best Practices

* Prefer self-hosting for better resilience against blockers.
* Flatten event payloads.
* Respect DNT unless you have strong legal clearance.


## Related Docs

- [Global configuration keys](/reference/configuration)
- [Plausible CSP guidance](/guides/csp#umami-plausible-no-external-scripts)
