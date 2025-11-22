# Debugging & Diagnostics


## Turn on Debug

```ts
createAnalytics({ debug: true });
```

You’ll see namespaced logs like:

* Provider lifecycle (`[no-op]`, `Provider ready`)
* Consent changes (`Consent changed`)
* Queue actions (`Event queued`, `Replaying SSR events`)


## Inspect Internals (safe API)

```ts
const diag = createAnalytics({ debug: true }).getDiagnostics();
console.table(diag);
```

Useful fields:

- `config.debug`, `config.autoTrack`, `config.queueSize` – confirms what options the facade is actually running with.
- `consent.status`, `consent.version`, `consent.method` – current consent state and how it was obtained.
- `provider.key`, `provider.state`, `provider.history` – which provider is active and how its state has changed over time.
- `queue.totalBuffered`, `queue.ssrQueueBuffered`, `queue.facadeQueueBuffered`, `queue.capacity` – how many events are buffered in SSR vs runtime queues and what the configured capacity is.
- `urls.lastPlanned`, `urls.lastSent` – the last URL that was prepared for tracking and the last URL actually sent to the provider.
- `performance.initTime`, `performance.avgProcessingTime`, `performance.avgNetworkLatency` – coarse-grained performance metrics for initialisation, event processing, and network dispatch.
- `performance.totalEvents`, `performance.failedEvents` – how many events have been observed by the tracker and how many failed processing.


## Common Pitfalls

* **No events on localhost:** set `TRACKKIT_TRACK_LOCALHOST=true` or create your instance with `{ trackLocalhost: true }`
* **DNT blocking:** set `doNotTrack: false` **only** if your policy allows
* **No pageviews:** ensure `autoTrack: true` and your `domains`/`exclude` rules permit the URL
* **Consent stuck pending:** call `analytics.grantConsent()` (or the singleton `grantConsent()`) on explicit user action, or wire your CMP callbacks to the corresponding Trackkit methods
