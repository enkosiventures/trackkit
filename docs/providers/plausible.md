# Plausible Provider

The Plausible provider sends analytics to Plausible (cloud or self-host) without loading external scripts.

## Features (Stage 6)

- ✅ Cookieless, privacy-friendly
- ✅ Automatic SPA pageviews (`autoTrack: true`)
- ✅ Custom events via `track()`
- ✅ Domain allowlist & path exclude
- ✅ Consent-aware queueing and flush
- ✅ Optional revenue props passthrough (see below)
- ✅ DNT respected by default

> **No user identification:** `identify()` is a no-op in this adapter.

---

## Configuration

### Minimal

```ts
import { init } from 'trackkit';

init({
  provider: 'plausible',
  site: 'yourdomain.com',
  // host: 'https://plausible.io'          // cloud
  // host: 'https://analytics.example.com' // self-host
});
```

### Common options

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  host: 'https://plausible.io',
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

**Environment variables (Vite example)**

```env
VITE_TRACKKIT_PROVIDER=plausible
VITE_TRACKKIT_SITE=yourdomain.com
VITE_TRACKKIT_HOST=https://plausible.io
VITE_TRACKKIT_DEBUG=false
```

You can also inject `window.__TRACKKIT_ENV__` at runtime.

---

## API usage

### Pageviews

* **Automatic:** `autoTrack: true`.
* **Manual:** call `pageview()` *after* you change the URL.

```ts
import { pageview } from 'trackkit';

history.pushState({}, '', '/thank-you');
pageview(); // uses current URL
```

### Custom events

```ts
import { track } from 'trackkit';

track('Signup');

track('Purchase', {
  value: 29.99,
  currency: 'USD',
  order_id: 'ORD-123',
});
```

> Plausible expects simple key/value props. Trackkit flattens basic primitives; nested objects are ignored.

### Consent

```ts
import { grantConsent, denyConsent } from 'trackkit';

denyConsent();  // optional explicit start
grantConsent(); // flushes any queued events
```

---

## Notes & limitations

* **No user identification:** `identify()` is a no-op.
* **Exact-match domains:** wildcards/regex not supported at Stage 6.
* **Revenue:** Trackkit passes `value`/`currency` props through; configure revenue goals in Plausible UI.

---

## Debugging

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  debug: true,
});
```

You’ll see:

* Provider readiness & consent decisions
* Queueing vs sending
* Pageview de-duplication on fast SPA hops

---

## Best practices

1. Prefer env vars for deploy-time config.
2. Use `domains` to restrict reporting to your properties.
3. Keep props flat & minimal.
4. Respect DNT unless justified.
5. Consider self-hosting to reduce blockers.
