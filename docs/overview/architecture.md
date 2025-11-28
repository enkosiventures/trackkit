# Architecture

This page describes how Trackkit is structured internally and how events flow from your code to your analytics provider(s).

You do **not** need to understand all of this to use Trackkit, but it’s useful context if you’re debugging or contributing.


## High-level picture

At runtime, Trackkit looks like this:

```txt
Your app
  └─> Facade (instance or singleton)
        ├─> PolicyGate (DNT, domain/paths, localhost)
        ├─> ConsentManager
        ├─> QueueService (runtime + SSR)
        └─> ProviderManager
              ├─> Provider adapter (Umami, Plausible, GA4, noop, or custom)
              └─> NetworkDispatcher
                    ├─> Transports (fetch, beacon, proxy)
                    └─> Retry / backoff
```

Every event goes through the same canonical pipeline:

> **PolicyGate → Consent → Provider readiness → Queue/Offline → Transport**

If any gate blocks an event, it is either queued or dropped depending on configuration.


## Modules by responsibility

### Facade (`src/facade/*`, `factory.ts`, `index.ts`, `ssr.ts`)

The facade is the public API surface exposed by:

* `createAnalytics()` (instance API)
* `init()`, `track()`, `pageview()`, etc. (singleton helpers)
* `trackkit/ssr` (SSR variants)

Key files:

* `facade/index.ts` – core facade implementation and method wiring.
* `facade/config.ts` – merges runtime options, env defaults, and schema defaults.
* `facade/context.ts` – holds current state (consent, provider readiness, queues, URLs).
* `facade/navigation.ts` – autotrack (history/URL) integration.
* `facade/policy-gate.ts` – applies DNT, domain allowlist, exclude rules, localhost rules.
* `facade/diagnostics.ts` – builds diagnostics snapshots.
* `facade/provider-manager.ts` – selects, initialises, and talks to provider adapters.
* `facade/singleton.ts` – singleton wrapper around a shared facade instance.

The facade is the only layer that users call. It owns:

* applying configuration,
* orchestrating consent and queueing,
* delegating to providers and dispatchers,
* exposing a stable API for diagnostics and helpers.

---

### Configuration (`src/config/schema.ts`, `src/util/env.ts`)

Configuration is schema-driven:

* `config/schema.ts` defines the shape of `InitOptions` and how defaults are applied.
* `util/env.ts` reads build-time env (`TRACKKIT_*`, `VITE_TRACKKIT_*`, etc.) and runtime overrides (`window.__TRACKKIT_ENV__`, meta tags).

The merge order (simplified):

1. Schema defaults
2. Env / runtime defaults
3. Explicit options passed to `createAnalytics()` / `init()`

Provider-specific identifiers (`website`, `domain`, `measurementId`) can be set directly or via the unified `site` field; the config layer normalises this before it reaches providers.

---

### Consent (`src/consent/*`)

* `ConsentManager.ts` manages the consent state machine (`pending`, `granted`, `denied`) and options like:

  * `initialStatus`
  * `requireExplicit`
  * `allowEssentialOnDenied`
* `types.ts` defines consent-related types and config shape.
* `exports.ts` wires consent methods into the public API (instance and singleton helpers).

Consent doesn’t send or queue events itself. It tells the facade which events are allowed to be sent:

* analytics events follow the consent gate strictly,
* essential events may be allowed under denied-consent depending on config.

---

### Queues (`src/queues/*`)

* `runtime.ts` – in-memory runtime queue for client-side events.
* `ssr.ts` – server-side queue for SSR events (used by `trackkit/ssr`).
* `service.ts` – queue service that coordinates adding, trimming, flushing, and observing queues.
* `index.ts` / `types.ts` – shared interfaces and helpers.

Responsibilities:

* holding events while:

  * consent is `pending`,
  * the provider is not ready,
  * the network is offline (with optional offline store),
* enforcing bounded size:

  * dropping **oldest** events on overflow (signalled via `QUEUE_OVERFLOW`),
* replaying events once gates allow.

SSR events are written into the SSR queue on the server and hydrated into the runtime queue on the client exactly once per page load.

---

### Connection & offline (`src/connection/*`)

* `monitor.ts` – connection monitor (online/offline/slow indicators).
* `offline-store.ts` – optional persistent store for events when offline.

The connection layer feeds into the queue/dispatcher:

* when offline, events can be moved from the runtime queue into offline storage,
* when the connection returns, events are drained back into the runtime queue and go through the normal gating pipeline again.

Offline storage is capacity-limited and does not bypass consent or policy rules.

---

### Dispatcher & transports (`src/dispatcher/*`)

The dispatcher is responsible for actually sending HTTP requests, separate from providers.

Key files:

* `network-dispatcher.ts` – orchestrates dispatch, batching, retry, and transport selection.
* `batch-processor.ts` – groups events into batches where enabled.
* `retry.ts` – retry / backoff policy.
* `adblocker.ts` – heuristics for detecting blocked requests.
* `transports/index.ts` – selects between concrete transports:

  * `fetch.ts` – standard `fetch`-based sending.
  * `beacon.ts` – `navigator.sendBeacon` for fire-and-forget use cases.
  * `proxy.ts` – first-party proxy transport (hits your own domain).
  * `resolve.ts` – logic for choosing the right transport based on environment & config.
* `types.ts` – dispatcher and transport types.

Providers do not talk directly to `fetch`/`XMLHttpRequest` etc. They call into the dispatcher with:

* URL
* HTTP method
* payload/body
* headers/metadata

The dispatcher chooses *how* to send (fetch, beacon, proxy) and handles retries.

---

### Providers (`src/providers/*`)

Providers are thin adapters from the Trackkit event model into concrete analytics backends.

Structure:

* `base/adapter.ts` – base adapter contracts.
* `base/transport.ts` – provider-facing abstraction over NetworkDispatcher.
* `umami/` – Umami adapter:

  * uses Umami HTTP API, no remote scripts. 
* `plausible/` – Plausible adapter:

  * uses Plausible API, no remote scripts. 
* `ga4/` – GA4 adapter:

  * uses Measurement Protocol only (no gtag.js). 
* `noop/` – a no-op provider for local dev/testing.
* `registry.ts` – maps provider keys (`'umami'`, `'plausible'`, `'ga4'`, `'noop'`) to factories.
* `loader.ts` – resolves provider factories at runtime.
* `metadata.ts` – provider metadata (name, version, defaults).
* `stateful-wrapper.ts` – wraps stateless adapters with minimal provider state/history for diagnostics.
* `normalize.ts`, `navigation-sandbox.ts`, `browser.ts`, `types.ts` – plumbing and types.

Each provider implements:

* `pageview(url, ctx)`
* `track(name, props, ctx)`
* `identify(userId, traits?)`
* optional `getSnapshot()` for diagnostics
* `destroy()`

Unsupported methods are **safe no-ops**, not errors.

---

### Policy gate (`src/facade/policy-gate.ts`)

The policy gate applies:

* Do Not Track (`doNotTrack`)
* Domain allowlist (`domains`)
* Path exclusions (`exclude`)
* Localhost rules (`trackLocalhost`)

It runs **before** consent and drops events early when policy forbids them.

---

### Performance tracking (`src/performance/tracker.ts`)

The performance tracker measures:

* time spent in the facade,
* queue wait times,
* dispatch timings per provider.

It observes the system; it does not change behaviour.

SSR code paths are excluded from metrics.

---

### Utilities (`src/util/*`, `errors.ts`, `constants.ts`, `types.ts`)

* `util/env.ts` – env detection and reading.
* `util/logger.ts` – structured debug logging.
* `util/state.ts` – helper for tracking state history (used by diagnostics).
* `errors.ts` – strongly typed error codes and error helpers.
* `constants.ts` – shared constants.
* `types.ts` – core types for the public API and internal plumbing.


## Event lifecycle walkthrough

Here’s how a typical event flows through Trackkit:

1. Your app calls `analytics.track('purchase', props)` (or singleton `track()`).
2. The facade:

   * normalises the event payload,
   * attaches context (URL, referrer, timestamp, consent metadata).
3. PolicyGate checks:

   * DNT, domain allowlist, path exclusion, localhost rules.
   * If it fails, the event is dropped here.
4. ConsentManager decides:

   * if `pending` → event goes to the runtime queue.
   * if `denied` → analytics events dropped; essential events may proceed depending on `allowEssentialOnDenied`.
   * if `granted` → event can proceed (subject to provider readiness).
5. Provider readiness:

   * if not ready → event stays in the runtime queue.
   * if ready → event is handed to the ProviderManager.
6. ProviderManager:

   * looks up the active adapter,
   * translates the event into a provider payload.
7. NetworkDispatcher:

   * batches if configured,
   * selects a transport (fetch / beacon / proxy),
   * sends the HTTP request with retry/backoff.
8. Diagnostics:

   * facade and provider update their snapshots (queue sizes, last sent URL, provider state, errors).

SSR:

* On the server, `trackkit/ssr` calls write into the SSR queue only.
* The SSR queue is serialised into HTML.
* On the client, the facade hydrates the SSR queue into the runtime queue once and then the same pipeline runs as above.


## How this informs usage

* **You** control what is tagged as essential vs analytics; Trackkit enforces your policy consistently.
* Providers remain interchangeable; the queue/policy/consent semantics stay the same.
* Resilience (offline, proxy, transport) is orthogonal to business logic; you can tune it without changing event calls.

For more detail on specific axes, see:

* Guides → Queue Management
* Guides → Consent & Privacy
* Guides → Server-Side Rendering
* Guides → Resilience & Transports
* Providers → Umami / Plausible / GA4
