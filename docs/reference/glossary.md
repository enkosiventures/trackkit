
# Glossary

## Analytics event

A single unit of analytics data emitted by your application, such as a pageview, signup, or button click. In Trackkit, all events flow through the facade (`track`, `pageview`, `identify`) before being normalised and sent to a provider.


## Provider

An analytics backend that receives events from Trackkit, e.g. **Umami**, **Plausible**, or **GA4**. Providers are selected via the `provider` option and are interchangeable behind the Trackkit facade.


## Facade

The internal object that coordinates configuration, queues, consent, and provider dispatch. Both the instance API (`createAnalytics()`) and singleton helpers (`init`, `track`, etc.) talk to a facade under the hood.


## Instance API

The preferred integration style. Calling `createAnalytics(opts)` returns an `AnalyticsInstance` that wraps a single facade:

```ts
const analytics = createAnalytics({ provider: 'umami', site: 'my-site' });
```

Instances are easier to reason about in modern apps (SSR, multi-tenant, tests) because they avoid global state.


## Singleton API

A convenience style that exposes global helpers like `init`, `track`, and `pageview`:

```ts
init({ provider: 'umami', site: 'my-site' });
track('signup_completed');
```

The singleton is suitable for small sites and legacy code. For new apps, prefer the instance API.


## Consent status

The current state of the consent system. One of:

* `pending` – user has not made a decision yet.
* `granted` – analytics is allowed under your policy.
* `denied` – non-essential analytics is not allowed.

Consent status controls whether events are queued, flushed, or dropped.


## Essential vs analytics events

A conceptual distinction used by the consent system:

* **Essential events** – events you consider strictly necessary (e.g. security, billing, core service telemetry).
* **Analytics events** – everything else (funnel analysis, marketing attribution, etc.).

Your configuration and application code decide what to treat as essential and thus necessary for correct operation. Trackkit itself tags only a few events as essential (e.g., `identify`, internal provider bootstrap signals). Essential events bypass the analytics‐consent gate only if `allowEssentialOnDenied === true`, but still respect:
• provider readiness
• DNT (if enabled)
• localhost rules
• domain/exclude filters


## Runtime queue

The in-memory buffer used on the client to hold events when they cannot yet be sent. Common reasons:

* Provider is still initialising.
* Consent is `pending`.
* Network or policy rules temporarily block sending.

The runtime queue respects `queueSize` and signals overflow via the `QUEUE_OVERFLOW` error code.


## SSR queue

A separate in-memory buffer used **during server-side rendering**. Server-side calls to the SSR API (`trackkit/ssr`) write into this queue without initialising providers or sending network requests. The queue is serialised into HTML and hydrated on the client.

On the client, the facade:

1. Hydrates from the SSR queue once.
2. Replays events, subject to consent and provider readiness.
3. Treats the SSR queue as drained.


## Hydration (SSR)

The process of:

1. Reading server-recorded events from `window.__TRACKKIT_SSR_QUEUE__`.
2. Enqueuing them into the client runtime queue.
3. Replaying them through the configured provider when consent and readiness allow.

Hydration happens once per page load during facade initialisation.


## Provider readiness

A state indicating that the selected provider is fully initialised and ready to accept events (e.g. network endpoint resolved, any required bootstrap has completed). Trackkit will not flush queued events until both:

* provider is ready, and
* consent allows sending.

`waitForReady()` resolves when this condition is met.


## Policy gate

The internal component that applies domain, path, DNT, localhost, and consent rules to each event before it is enqueued or sent. If a rule blocks an event (for example, `DO_NOT_TRACK` is enabled), the event is dropped and a `POLICY_BLOCKED` error may be surfaced via `onError`.


## Diagnostics snapshot

A structured, read-only view of the facade state returned by `getDiagnostics()`. It typically includes:

* current config flags (debug, queue size, autoTrack, etc.)
* consent status and metadata
* provider key and state
* queue sizes (runtime and SSR)
* last planned and last sent URLs
* optional performance metrics (if enabled)

Diagnostics are intended for debugging, tooling, and dashboards, not for application logic.


## Unified `site` identifier

A provider-agnostic identifier field accepted by Trackkit configuration:

```ts
createAnalytics({ provider: 'umami', site: 'my-site-id' });
```

Internally, `site` is mapped to the provider-specific field:

* Umami → `website`
* Plausible → `site`
* GA4 → `measurementId`

You can still supply the provider-specific field directly; it overrides the generic mapping. The unified `site` field exists to simplify switching providers without rewriting config.


## Offline storage

An optional layer that persists events while the user is offline and syncs them later, when `connection.offlineStorage` is enabled. Runtime queueing still applies; offline storage controls how long events are retained beyond the current page lifetime.


## Connection monitor

An optional component that tracks connection health and latency when `connection.monitor` is enabled. It can mark the connection as slow or offline, influencing how and when events are dispatched and when offline storage should be used.
