# Debugging & Diagnostics

## Turn on Debug

```ts
init({ debug: true });
```

You’ll see namespaced logs like:

* Provider lifecycle (`[no-op]`, `Provider ready`)
* Consent changes (`Consent changed`)
* Queue actions (`Event queued`, `Replaying SSR events`)

## Inspect Internals (safe API)

```ts
const diag = init({ debug: true }).getDiagnostics();
console.table(diag);
```

Useful fields:

* `providerReady`, `provider`
* `consent`
* `facadeQueueSize`, `ssrQueueSize`, `totalQueueSize`
* `lastSentUrl`, `lastPlannedUrl`

## Common Pitfalls

* **No events on localhost:** set `TRACKKIT_TRACK_LOCALHOST=true` or `init({ trackLocalhost: true })`
* **DNT blocking:** set `doNotTrack: false` **only** if your policy allows
* **No pageviews:** ensure `autoTrack: true` and your `domains`/`exclude` rules permit the URL
* **Consent stuck pending:** call `grantConsent()` or wire your CMP → call Trackkit methods on user action
