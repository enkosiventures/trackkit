# Migrating from Umami Script

This guide is for sites using the **Umami script tag** (cloud or self-hosted) that want to replace it with Trackkit’s Umami adapter.

Trackkit calls Umami’s HTTP API directly, so no tracking script is required.


## Conceptual mapping

| Old (Umami)                                            | Trackkit                                           |
|--------------------------------------------------------|----------------------------------------------------|
| `<script src=".../script.js" data-website-id="...">`   | `createAnalytics({ provider: 'umami', site: '...' })` |
| Global `umami.track('event')`                          | `track('event')`                                   |
| `data-website-id`                                      | `site` option / `TRACKKIT_SITE`                   |
| Script placement & inline JS                           | Centralised TS/JS module                           |


## Step 0: Your current integration

Typical snippet:

```html
<script async defer src="https://analytics.example.com/script.js"
        data-website-id="94db1cb1-74f4-4a40-ad6c-962362670409"></script>

<script>
  umami.track('purchase-button');
</script>
```


## Step 1: Install Trackkit

```sh
npm install trackkit
```

---

## Step 2: Configure Trackkit (Umami)

### 2.1 Env vars

```sh
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=94db1cb1-74f4-4a40-ad6c-962362670409
TRACKKIT_HOST=https://analytics.example.com
```

### 2.2 Bootstrap code

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://analytics.example.com',
  autoTrack: true,
  doNotTrack: true,
  includeHash: false,
  trackLocalhost: true,
  debug: false,
});
```


## Step 3: Replace `umami.track(...)`

This:

```js
umami.track('purchase-button');
```

becomes:

```ts
import { track } from 'trackkit';

track('purchase-button');
```

You can attach this to the same UI events you previously wired to Umami.


## Step 4: Pageviews & routing

The script tag usually auto-tracks pageviews. With Trackkit:

* `autoTrack: true` will emit pageviews when the URL changes.
* For explicit calls:

```ts
import { pageview } from 'trackkit';

// after updating history:
history.pushState({}, '', '/thank-you');
pageview();
```

Note: Umami’s API doesn’t support arbitrary manual URLs in the same way the script does; Trackkit follows the browser’s location by default and expects you to keep history state in sync.


## Step 5: Consent (optional)

If you need to gate Umami against consent:

```ts
const analytics = createAnalytics({
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://analytics.example.com',
  consent: {
    initialStatus: 'pending',
    requireExplicit: true,
  },
});
```

Later:

```ts
analytics.grantConsent();  // flush queued events
// or
analytics.denyConsent();   // drop + block
```


## Step 6: Validate

1. Enable `debug: true` in a non-prod environment.
2. Open network tab:

   * Confirm POSTs to your Umami endpoint (`/api/send` or equivalent).
   * Confirm pageviews and events appear in your Umami dashboard.
3. Optionally run script + Trackkit in parallel (separate sites) for a short time to compare volume.


## Step 7: Remove the script tag

Once satisfied:

* Remove `<script ...src=".../script.js" data-website-id="...">`.
* Remove `umami.track(...)` calls.


## Limitations & differences

* `identify()` does nothing for Umami (no user identity concept).
* Manual URL overrides are limited; rely on the browser URL + history updates.
* CSP is simplified: you only need `connect-src` for the Umami host.

Trackkit’s Umami adapter is intentionally minimal: it aims to replicate what most people used the script for (pageviews + simple events) with better control and integration.
