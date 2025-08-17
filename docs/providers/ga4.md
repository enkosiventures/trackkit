# Google Analytics 4 (GA4) Provider

The GA4 provider integrates with Google Analytics 4. **At Stage 6 it lazy-loads the official `gtag.js` script** (async), and manages queuing, consent, and SPA pageviews for you.

## Features (Stage 6)

- ✅ Automatic SPA pageviews (`autoTrack: true`)
- ✅ Custom events via `track()`
- ✅ Optional `identify(userId)` → sets `user_id`
- ✅ Consent-aware queueing and flush
- ✅ Domain allowlist & path exclude
- ⚠️ Loads `https://www.googletagmanager.com/gtag/js?id=...`
- ⚠️ GA4 may set cookies (consent required in many regions)

---

## Configuration

### Minimal

```ts
import { init } from 'trackkit';

init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX', // Measurement ID
});
```

### Common options

```ts
init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  autoTrack: true,                       // History API + popstate
  doNotTrack: true,                      // default respected unless set to false
  includeHash: false,                    // ignore #fragment by default
  domains: ['example.com'],              // exact matches (no wildcards)
  exclude: ['/admin', '/preview'],       // substring/path checks (strings only)
  trackLocalhost: true,                  // enable for local dev if desired
  defaultProps: { appVersion: '2.3.1' }, // merged into event params
  debug: false,
});
```

**Environment variables (Vite example)**

```env
VITE_TRACKKIT_PROVIDER=ga
VITE_TRACKKIT_SITE=G-XXXXXXXXXX
VITE_TRACKKIT_DEBUG=false
```

> If you plan to use Measurement Protocol (server-side) later, Trackkit will add options in Stage 7+. At Stage 6, GA4 uses `gtag.js`.

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

track('purchase', {
  value: 29.99,
  currency: 'USD',
  items: [{ item_id: 'SKU-123', item_name: 'T-Shirt', price: 29.99, quantity: 1 }],
});
```

> Trackkit forwards props as GA4 event parameters where possible.

### Identify (optional)

```ts
import { identify } from 'trackkit';

identify('user-123'); // sets GA4 user_id for subsequent hits
```

### Consent

```ts
import { grantConsent, denyConsent } from 'trackkit';

denyConsent();  // optional explicit start
grantConsent(); // flushes queued events
```

> In the EU you typically must collect consent **before** GA4 sends data.

---

## CSP & network

Since GA4 loads `gtag.js`, you need CSP allowances:

```
script-src https://www.googletagmanager.com;
connect-src https://www.google-analytics.com https://region1.google-analytics.com;
```

(Exact domains vary; consult Google’s latest guidance.)

---

## Notes & limitations

* **External script:** GA4 requires `gtag.js` (Trackkit injects it async).
* **Cookies:** GA4 may set cookies; ensure compliant consent flows.
* **Exact-match domains & string-only `exclude`** per Stage 6.

---

## Debugging

```ts
init({
  provider: 'ga',
  site: 'G-XXXXXXXXXX',
  debug: true,
});
```

You’ll see:

* Provider readiness & `gtag` load state
* Queueing vs sending
* Pageview de-duplication

---

## Best practices

1. Ensure a compliant consent flow (queue until granted).
2. Use `identify()` only if you truly need user-level analysis.
3. Keep props consistent with GA4 recommended parameters.
4. Consider a server-side proxy/MP in Stage 7+ if you need stricter CSP.
