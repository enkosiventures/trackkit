# Performance Tracking

Trackkit includes a lightweight **PerformanceTracker** that can measure:

- initialisation time
- average synchronous event processing time
- average network latency for dispatches
- total and failed events it has observed

This guide explains what it measures and how to enable it.


## What PerformanceTracker actually measures

The tracker lives in `performance/tracker.ts` and keeps a simple metrics object:

- `initTime` – time between `markInitStart()` and `markInitComplete()`
- `avgProcessingTime` – moving average of synchronous `trackEvent()` durations
- `avgNetworkLatency` – moving average of `trackNetworkRequest()` durations
- `totalEvents` – number of successful `trackEvent()` calls
- `failedEvents` – number of `trackEvent()` calls that threw

The tracker uses `performance.now()` where available and falls back to no-op on the server.

It does **not** do detailed phase breakdown (DNS/TCP/TLS/etc.); it’s coarse-grained by design.


## Enabling performance tracking

Performance tracking is disabled by default. To turn it on, pass `performance.enabled: true` when creating your façade:

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'umami',
  site: '…',
  performance: {
    enabled: true,
    sampleRate: 1,   // track every event
    windowSize: 100, // how many recent events to keep
  },
});
```

Defaults (from `PERFORMANCE_DEFAULTS`) are safe to use for most apps.

> **Note:** Performance tracking is primarily a **debug / tuning** tool. It should not be treated as production-grade APM.


## What gets tracked

How the tracker is used in the facade/dispatcher:

* During initialisation:

  * `markInitStart()` is called before heavy setup.
  * `markInitComplete()` is called once the façade is ready.
* Around network dispatch:

  * Network sends are wrapped in `trackNetworkRequest('dispatch', fn)`, so `avgNetworkLatency` reflects your analytics request timings.
* Optionally, synchronous processing steps (e.g. queue processing, provider adaptation) can be wrapped with `trackEvent(() => { … })` to update `avgProcessingTime`, `totalEvents` and `failedEvents`.

Because `trackEvent` is **synchronous**, only wrap synchronous work in it.


## Accessing performance metrics

If performance tracking is enabled and wired into the facade, metrics are exposed via `getDiagnostics()`:

```ts
const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  debug: true,
  performance: { enabled: true },
});

const diag = analytics.getDiagnostics();
console.log(diag.performance);
```

You can expect a shape like:

```ts
{
  initTime: number;
  avgProcessingTime: number;
  avgNetworkLatency: number;
  totalEvents: number;
  failedEvents: number;
}
```

Use this to:

* sanity-check that init is fast enough
* spot unexpectedly slow processing steps
* compare network latency across environments


## Example: logging a simple performance summary

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'plausible',
  site: 'example.com',
  debug: true,
  performance: { enabled: true },
});

// later, e.g. from a debug panel
const { performance } = analytics.getDiagnostics();

if (performance) {
  console.table({
    initTimeMs: performance.initTime.toFixed(1),
    avgProcessingMs: performance.avgProcessingTime.toFixed(1),
    avgNetworkMs: performance.avgNetworkLatency.toFixed(1),
    totalEvents: performance.totalEvents,
    failedEvents: performance.failedEvents,
  });
}
```


## When should you enable this?

* **Local development / staging** – to spot slow code paths while you iterate.
* **Short-term production diagnostics** – e.g. turning it on behind a feature flag for a subset of users to investigate issues.
* **Continuous production monitoring** – only if you:

  * are comfortable with the minimal overhead, and
  * export metrics carefully (e.g. to your own logs) rather than shipping them to a third-party.

If you don’t evaluate or export these metrics anywhere, leave `performance.enabled` off – there’s no point paying complexity for unused numbers.
