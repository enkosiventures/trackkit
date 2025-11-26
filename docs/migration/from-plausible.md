# Migrating from Plausible Script

This guide is for sites currently using the **Plausible script tag** and global `plausible()` function who want to move to Trackkit’s Plausible adapter.

Trackkit keeps:

- Cookieless, privacy-friendly analytics.
- Simple event semantics.

and adds:

- Centralised config (env + code).
- Consent-aware queueing.
- SPA awareness and SSR options.


## Conceptual mapping

| Old (Plausible)                                   | Trackkit                                      |
|--------------------------------------------------|-----------------------------------------------|
| `<script src="https://plausible.io/js/script.js` | `createAnalytics({ provider: 'plausible',… })`|
| Global `plausible('event', props)`               | `track('event', props)`                       |
| `data-domain` attribute                          | `site` option / `TRACKKIT_SITE`              |
| On-page consent  gating around script            | `consent.initialStatus`, `grantConsent()`    |


## Step 0: Identify your current integration

Typical snippet:

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
<script>
  plausible('Signup', { props: { plan: 'Pro' } });
</script>
```

Your goal: replace the script tag + global function with Trackkit calls.


## Step 1: Install Trackkit

```bash
npm install trackkit
```


## Step 2: Configure Trackkit (Plausible)

### 2.1 Env vars

```env
TRACKKIT_PROVIDER=plausible
TRACKKIT_SITE=yourdomain.com
TRACKKIT_HOST=https://plausible.io
```

### 2.2 Bootstrap code

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
  host: 'https://plausible.io',
  autoTrack: true,
  doNotTrack: true,
  includeHash: false,
  trackLocalhost: true,
  debug: false,
});
```


## Step 3: Replace event calls

This:

```js
plausible('Signup', { props: { plan: 'Pro' } });
```

becomes:

```ts
import { track } from 'trackkit';

track('Signup', { plan: 'Pro' });
```

Plausible expects **flat** event props. Trackkit will flatten simple objects, but avoid deeply nested structures.


## Step 4: Pageviews & SPA

With the standard script, Plausible auto-tracks pageviews.

With Trackkit:

* `autoTrack: true` gives you automatic SPA pageviews when the URL changes.
* You can also call `pageview()` manually in edge cases:

```ts
import { pageview } from 'trackkit';

history.pushState({}, '', '/thank-you');
pageview();
```

Use `domains` and `exclude` to limit what gets tracked:

```ts
createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
  domains: ['yourdomain.com'],
  exclude: ['/admin', '/preview'],
});
```


## Step 5: Consent

Instead of manually avoiding `plausible()` calls, let Trackkit hold the events and release them when consent is granted.

```ts
const analytics = createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
  consent: {
    initialStatus: 'pending',
    requireExplicit: true,
  },
});
```

On user action:

```ts
analytics.grantConsent(); // flushes queued events
// or
analytics.denyConsent();  // drops + blocks
```


## Step 6: Validate

1. Enable `debug: true` during migration.
2. Open your site and check:

   * Pageviews are hitting the Plausible endpoint.
   * Key events show in the Plausible dashboard.
3. Compare counts with your script-based setup (possibly run both behind a feature flag for a short period).


## Step 7: Remove the script tag

Once you’re satisfied:

* Remove the `<script defer … src="https://plausible.io/js/script.js">`.
* Remove on-page `plausible()` calls.

Optionally keep a feature flag for a while that lets you re-enable the old script in non-prod if needed.


## Limitations & differences

* `identify()` is effectively a no-op for Plausible (no user identity).
* Arbitrary nested props are not represented perfectly; prefer flat key/value props.
* CSP is generally simpler: you only need `connect-src` rules for your Plausible host.
