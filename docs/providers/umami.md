# Umami Provider

The Umami provider sends analytics to your Umami instance (self-hosted or cloud) without loading external scripts.

## Features (Stage 6)

* ✅ Cookieless, privacy-friendly
* ✅ Automatic SPA pageviews (`autoTrack: true`)
* ✅ Custom events via `track()`
* ✅ DNT respected by default
* ✅ Domain allowlist & path exclude
* ✅ Consent-aware queueing and flush

> **Not supported by Umami:** user identification/audiences. `identify()` is a no-op for this adapter.

---

## Configuration

### Minimal

```ts
import { init } from 'trackkit';

init({
  provider: 'umami',
  site: 'your-website-id',
  // host: 'https://analytics.example.com' // required if not using Umami cloud default for your setup
});
```

### Common options

```ts
init({
  provider: 'umami',
  site: 'your-website-id',
  host: 'https://analytics.example.com', // required for self-host
  autoTrack: true,                        // SPA pageviews
  doNotTrack: true,                       // default: respected if not set to false
  domains: ['example.com', 'www.example.com'], // exact matches
  exclude: ['/admin', '/preview'],        // substring/path checks (strings only at Stage 6)
  includeHash: false,                     // ignore #fragment by default
  trackLocalhost: true,                   // enable in local dev if desired
  defaultProps: { appVersion: '2.3.1' },  // merged into event props
  debug: false,
});
```

**Environment variables (Vite example)**

```env
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=your-website-id
VITE_TRACKKIT_HOST=https://analytics.example.com
VITE_TRACKKIT_DEBUG=false
```

You can also inject `window.__TRACKKIT_ENV__` at runtime if you need to configure without rebuilds.

---

## API usage

### Pageviews

* **Automatic:** set `autoTrack: true` in `init()`.
* **Manual:** call `pageview()` *after* you change the URL (e.g., `pushState`).

```ts
import { pageview } from 'trackkit';

// manual virtual PV
history.pushState({}, '', '/virtual/thank-you');
pageview(); // uses current URL
```

> `pageview()` does **not** accept a URL parameter at Stage 6.

### Custom events

```ts
import { track } from 'trackkit';

track('newsletter_signup');

track('purchase', {
  product: 'T-Shirt',
  price: 29.99,
  currency: 'USD',
});
```

> Keep props simple: strings/numbers/booleans. Deep objects are typically ignored by Umami’s API.

### Consent

```ts
import { grantConsent, denyConsent } from 'trackkit';

denyConsent();  // optional: explicit initial state
// ... user accepts:
grantConsent(); // flushes any queued events
```

---

## Limitations

* **No user identification**: `identify()` is a no-op in this adapter.
* **Exact-match domains**: wildcards/regex are not supported at Stage 6.
* **Manual pageview URL**: not supported; change `history` then call `pageview()`.

---

## Debugging

Enable rich logs:

```ts
init({
  provider: 'umami',
  site: 'your-website-id',
  debug: true,
});
```

You’ll see:

* Provider readiness & consent decisions
* Queueing vs sending decisions
* Duplicate pageview de-duplication

---

## Best practices

1. **Use env vars** for deploy-time config.
2. **Self-host** your Umami under your domain to reduce blockers.
3. **Keep props flat** (avoid nested objects).
4. **Respect DNT** unless you have strong justification.
5. **Whitelist** only the domains you serve.

---
