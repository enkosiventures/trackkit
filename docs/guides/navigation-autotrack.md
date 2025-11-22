# Navigation & Autotrack

For SPAs, Trackkit can automatically send pageviews when the URL changes.

## Enable

```ts
createAnalytics({
  autoTrack: true,   // turn on
  includeHash: false // remove #hash from URLs (default)
});
```

## URL Policy

* `includeHash: false` strips `#fragment`
* `urlTransform?: (url) => string` lets you normalize routes (e.g., strip IDs)
* `domains?: string[]` restrict pageviews to certain hostnames
* `exclude?: string[]` drop pageviews whose URL contains one of these substrings

## Manual Pageviews

If you prefer manual control:

```ts
const analytics = createAnalytics({ autoTrack: false });

analytics.pageview();        // current location
analytics.pageview('/home'); // explicit (rare)
```

## Duplicate Guard

Trackkit dedupes pageviews at the scheduled stage—emitting the same URL twice in a row is ignored to prevent double hits from navigation sandboxes.
