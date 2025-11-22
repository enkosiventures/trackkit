# Queue Management

Trackkit buffers events when it’s *not safe* to send yet, then replays them in order once conditions are met.

> **Want to see queue management in action?**
>
> Run the [Consent & Queue Playground](/examples/consent-queue-playground) and see event queueing in action.


## Event Categories

Trackkit distinguishes between two categories:

- **`essential`** — lifecycle-critical calls such as `identify`, provider setup pings, or framework-level events.
- **`analytics`** — regular events (`track`, `pageview`) subject to consent and policy gating.

When consent = **denied**, only essential events remain eligible for sending; analytics events are dropped or queued depending on your policy settings.

> [Consent & Privacy](/guides/consent-and-privacy) explains how categories (`essential` vs `analytics`) map to your policy.


## Overflow Semantics

Trackkit applies a fixed-capacity, in-memory queue.  
When the queue exceeds `queueSize`:

- The **oldest events** are dropped first.
- A `QUEUE_OVERFLOW` error is surfaced to your `onError` handler.
- If configured, the overflow callback receives the dropped items.

This ensures that **newest interactions are preserved**, even under heavy load or long pending-consent windows.


## Trimming Logic

Reconfiguring the queue (e.g. reducing `queueSize`) applies the same rule:

- If the queue now exceeds capacity, the oldest items are trimmed.
- Essential items are preserved when calling `flushEssential()` or `clearNonEssential()`.

These semantics ensure deterministic behaviour across SSR, pending consent, and retry conditions.

## When We Queue

1. **Provider not ready (async load)**

```ts
const analytics = createAnalytics({ provider: 'umami', site: 'example.com' });

// Immediately after creating the instance:
analytics.track('clicked');
// If the provider is still initializing, this event is queued.
```

2. **Consent pending**

```ts
const analytics = createAnalytics({
  provider: 'umami',
  consent: {
    initialStatus: 'pending',
    requireExplicit: true,
  },
});

analytics.track('signup_submit'); // queued
analytics.grantConsent();         // flushes the queue in order
```

3. **SSR hydration**

Events collected on the server are injected into the page and **replayed** on the client after the provider is ready and consent allows it.

> Best practice: create your analytics instance as early as possible on the client. Events sent before an instance exists cannot be buffered.

> [SSR Guide](/guides/ssr) shows how the SSR queue (`window.__TRACKKIT_SSR_QUEUE__`) is hydrated once on the client.


## Configuring the Queue

```ts
const analytics = createAnalytics({
  provider: 'umami',
  queueSize: 100, // default 50
  onError: (err) => {
    if (err.code === 'QUEUE_OVERFLOW') {
      console.warn('Analytics queue full; oldest events dropped');
    }
  },
});
```

When the in-memory queue exceeds `queueSize`, Trackkit drops **oldest** events and emits a single `QUEUE_OVERFLOW` error describing what was dropped.


## Observability

Use the public diagnostics surface:

```ts
const analytics = createAnalytics({ debug: true });

const diagnostics = analytics.getDiagnostics();
/*
{
  id: 'AF_xxx',
  hasProvider: true,
  providerReady: true,
  queueState: { ... },
  facadeQueueSize: 0,
  ssrQueueSize: 0,
  totalQueueSize: 0,
  initializing: false,
  provider: 'umami',
  consent: 'granted',
  debug: true,
  lastSentUrl: '/current',
  lastPlannedUrl: '/current'
}
*/
```

You can safely read `facadeQueueSize`, `ssrQueueSize`, and `totalQueueSize` to understand what’s currently buffered.


## SSR Flow

On the **server**, collect events and serialize into the HTML:

```ts
// Server
import { ssrTrack, serializeSSRQueue } from 'trackkit/ssr';

ssrTrack('server_render', { route: '/product/123' });

// In your template <head>:
head += serializeSSRQueue();
// emits: <script>window.__TRACKKIT_SSR_QUEUE__=[...];</script>
```

On the **client**, Trackkit automatically hydrates and replays SSR events *after* the provider is ready and consent allows it. If consent is pending, SSR events are held until consent is granted.

> The SSR queue is global per page via `window.__TRACKKIT_SSR_QUEUE__`. Any facade you create on the client (instance or singleton) will see that queue and gate replay through the same consent and policy rules as normal events.


## Transports & resilience (advanced)

By default, Trackkit sends events with `fetch`:

```ts
createAnalytics({
  provider: 'umami',
  site: '...',
  // transport: 'auto' is the default
});
```

If you enable blocker detection, Trackkit can switch transports when ad blockers are detected:

```ts
createAnalytics({
  provider: 'plausible',
  site: '...',
  resilience: {
    detectBlockers: true,
    fallbackStrategy: 'proxy', // 'proxy' | 'beacon' | 'none'
    proxy: {
      proxyUrl: 'https://analytics-proxy.example.com/collect',
      token: process.env.TRACKKIT_PROXY_TOKEN,
      // optional allowlist / headers...
    },
  },
});
```

Behaviour:

* With `detectBlockers: false` (default), events go via `fetch` directly to the provider.
* With `detectBlockers: true`:

  * If no blockers are detected, `fetch` is still used.
  * If the provider endpoint looks blocked:

    * `fallbackStrategy: 'beacon'` → use `navigator.sendBeacon`.
    * `fallbackStrategy: 'proxy'` → use the configured proxy if `proxyUrl` is set, otherwise fall back to beacon.
    * `fallbackStrategy: 'none'` → no special fallback; events may fail if the original endpoint is blocked.
