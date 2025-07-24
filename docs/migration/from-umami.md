# Migrating from Vanilla Umami to Trackkit

This guide shows how to move from the standard Umami `<script>` tag to Trackkit’s Umami provider.

## Before: Script Tag

```html
<!-- Traditional Umami -->
<script async defer
  src="https://analytics.example.com/script.js"
  data-website-id="94db1cb1-74f4-4a40-ad6c-962362670409"
  data-domains="example.com,www.example.com"
  data-auto-track="true">
</script>

<script>
  // Custom events via the global `umami`
  document.getElementById('buy-button').addEventListener('click', () => {
    umami.track('purchase-button');
  });
</script>
```

## After: Trackkit

### 1) Install

```bash
npm install trackkit
```

### 2) Configure via environment (recommended)

```env
# .env (Vite example)
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=94db1cb1-74f4-4a40-ad6c-962362670409
VITE_TRACKKIT_HOST=https://analytics.example.com
VITE_TRACKKIT_DEBUG=false
```

### 3) Initialize in code

```ts
import { init, track } from 'trackkit';

const analytics = init({
  // Exact matches only (no wildcards at Stage 6)
  domains: ['example.com', 'www.example.com'],

  // Autotrack SPA pageviews (History API + popstate)
  autoTrack: true,
});

// Custom events — same mental model as Umami
document.getElementById('buy-button')?.addEventListener('click', () => {
  track('purchase-button');
});
```

> Trackkit loads no third-party `<script>` tags. Network calls go directly to your Umami host.

---

## Key Differences

### 1) No external scripts

* ✅ Fewer CSP headaches (`connect-src` only; `script-src` not required for the tracker)
* ✅ Less ad-blocker interference (especially when you self-host)
* ✅ Smaller render-blocking footprint

**CSP example**

```
connect-src 'self' https://analytics.example.com;
```

### 2) Consent built in

Trackkit queues while consent is pending and flushes after grant.

```ts
import { grantConsent, denyConsent } from 'trackkit';

// Set initial policy (optional; defaults to "pending")
denyConsent();

// Later, when the user accepts:
grantConsent(); // queued events are flushed
```

> By default, Trackkit **respects Do Not Track**. You can disable that with `doNotTrack: false` (not recommended).

### 3) TypeScript-first DX

```ts
import { track } from 'trackkit';

track('purchase', {
  product_id: 'SKU-123',
  price: 29.99,
  currency: 'USD',
});
```

### 4) SPA-friendly pageviews

With `autoTrack: true`, Trackkit listens to `pushState/replaceState/popstate` and de-dupes duplicate URLs.

* **Manual pageview** (rare): Trackkit’s `pageview()` uses the **current** URL by design. For a virtual pageview:

  ```ts
  // Update history, then call pageview()
  window.history.pushState({}, '', '/virtual/thank-you');
  import { pageview } from 'trackkit';
  pageview();
  ```

### 5) Errors are surfaced

```ts
init({
  onError: (error) => {
    console.error('Analytics error:', error.code, error.message);
    // e.g., forward to Sentry
  },
});
```

---

## Advanced Migration

### Domain allowlist

Stage 6 uses **exact string matches** (no wildcards or regex):

```ts
init({
  domains: ['example.com', 'www.example.com', 'app.example.com'],
});
```

*If you omit `domains`, domain filtering is skipped (other policies still apply).*

### Disable auto-tracking

```ts
import { init, pageview } from 'trackkit';

init({ autoTrack: false });

// Manually report pageviews (uses current URL):
router.afterEach(() => pageview());
```

### Server-Side Rendering (SSR)

Trackkit records events server-side into a global queue and replays them client-side on init. If you’re using SSR, serialize the queue into the HTML and let the client hydrate it on load. (If you’re not using SSR, you can ignore this.)

---

## Testing the migration

1. **Network tab**: verify requests are sent to `https://analytics.example.com`.
2. **Console**: `debug: true` prints send/queue decisions and errors.
3. **Umami dashboard**: confirm pageviews and events appear as expected.

```ts
init({
  debug: true,
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://analytics.example.com',
});
```

---

## Rollback plan

You can temporarily keep both implementations and flip with a flag:

```ts
const useTrackkit = new URLSearchParams(location.search).has('use-trackkit');

if (useTrackkit) {
  import('trackkit').then(({ init }) => init());
} else {
  const s = document.createElement('script');
  s.async = true;
  s.defer = true;
  s.src = 'https://analytics.example.com/script.js';
  s.setAttribute('data-website-id', '94db1cb1-74f4-4a40-ad6c-962362670409');
  document.head.appendChild(s);
}
```

---

## Common issues

### “Events not sending”

* Ensure consent is granted: `grantConsent()`
* Check your `domains` array (exact matches only)
* DNT may be blocking on purpose (default); set `doNotTrack: false` to ignore
* Look for validation/debug logs with `debug: true`

### “Counts differ vs script tag”

Trackkit may:

* De-dupe duplicate pageviews on rapid SPA transitions
* Avoid sending without consent / with DNT
* Filter more consistently by domain policy

---
