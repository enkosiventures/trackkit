# Public API Overview

This page documents the public API surface of the Trackkit JavaScript SDK.

> Looking for full SDK signatures? See the **[SDK (TypeDoc) reference](/reference/sdk/README)**.


## Summary

Core functions are imported from `trackkit`, the main entrypoint:

| Function | Instance? | Singleton? | Description |
|---------|-----------|-------------|-------------|
| `createAnalytics(opts)` | ✔️ | — | Creates an isolated facade instance. Preferred for modern apps. |
| `init(opts)` | — | ✔️ | Initializes the global singleton façade. |
| `destroy()` | ✔️ | ✔️ | Tears down listeners, clears queues. |
| `track(name, props?, category?)` | ✔️ | ✔️ | Sends a custom analytics event. |
| `pageview(url?)` | ✔️ | ✔️ | Sends a pageview (or inferred URL). |
| `identify(userId?)` | ✔️ | ✔️ | Identifies a user; provider-specific behaviour applies. |
| `grantConsent()` | ✔️ | ✔️ | Set consent → `granted`, flush queue. |
| `denyConsent()` | ✔️ | ✔️ | Set consent → `denied`, drop analytics items. |
| `resetConsent()` | ✔️ | ✔️ | Return consent to `pending`. |
| `getConsent()` | ✔️ | ✔️ | Return current consent snapshot. |
| `waitForReady()` | ✔️ | ✔️ | Promise that resolves when provider is ready. |
| `flushIfReady()` | ✔️ | ✔️ | Flush queue if provider + consent allow. |
| `hasQueuedEvents()` | ✔️ | ✔️ | Indicates buffer state. |
| `getDiagnostics()` | ✔️ | ✔️ | Internal state snapshot (provider, queue, consent, URLs). |

For server-side rendering (SSR), import from `trackkit/ssr`:

| Function | Purpose |
|----------|---------|
| `serializeSSRQueue()` | Emit `<script>` hydration payload. |
| `getSSRQueue()` | Retrieve queue array (server only). |
| `enqueueSSREvent()` | Low-level queue write. |
| `getSSRQueueLength()` | Convenience helper |
| `ssrTrack()` / `ssrPageview()` / `ssrIdentify()` | Server-side variants that queues instead of dispatching. |

TypeScript types are also exported from the main module:

```ts
import type {
  AnalyticsOptions,
  ProviderType,
  AnalyticsInstance,
  EventMap,
  ConsentStatus,
  ConsentStoredState,
  DiagnosticsSnapshot,
} from 'trackkit';
```


## Main module: `trackkit`

### Initialization

#### `createAnalytics<E extends EventMap = AnyEventMap>(opts?: AnalyticsOptions): AnalyticsInstance<E>`

Factory API. Creates a **new analytics instance**.

Use this as the preferred integration style:

```ts
import { createAnalytics } from 'trackkit';

type AnalyticsEvents = {
  signup_completed: { plan: 'free' | 'pro' };
};

const analytics = createAnalytics<AnalyticsEvents>({
  provider: { name: 'umami', site: 'my-site' },
  autoTrack: true,
});

// Use instance methods:
analytics.pageview();
analytics.track('signup_completed', { plan: 'pro' });
```

* `E` is an optional **event map** type for typed `track()` calls.
* `AnalyticsOptions` configures provider, queue, consent, resilience, etc.
  See the Configuration guide for full fields.

#### `init(opts?: AnalyticsOptions): AnalyticsFacade`

Singleton API. Initialises the **global** analytics facade.

```ts
import { init, pageview } from 'trackkit';

init({ provider: { name: 'umami', site: 'my-site' } });
pageview();
```

Use this when you prefer a global singleton (e.g. simple sites, legacy code). For new projects, prefer `createAnalytics`.

#### `destroy(): void`

Tears down the singleton instance:

* stops auto-tracking,
* clears queues,
* detaches listeners where possible.

Safe to call multiple times.

---

### Event methods

These exist on both:

* the **singleton** (imported directly), and
* **instances** returned from `createAnalytics`.

#### `track(eventName: string, props?: Record<string, unknown>): void`

Record a custom event.

```ts
track('signup_completed', { plan: 'pro', source: 'landing' });
```

When using typed events via `createAnalytics<MyEvents>`, `eventName` and `props` are type-checked. Props are **required** when the event map declares required fields, and optional when all fields are optional (or when no event map is provided).

#### `pageview(url?: string): void`

Record a pageview.

* `url` omitted → current `window.location`.
* `url` provided → explicit path.

Examples:

```ts
pageview();          // current URL
pageview('/pricing'); // explicit path
```

#### `identify(userId: string | null): void`

Associate a user identifier with subsequent events.

```ts
identify('user_123');
identify(null); // clear user association
```

Provider support for identify varies; check provider docs.

---

### Consent API

These functions operate on the **singleton** or an instance:

* singleton:

  ```ts
  import { grantConsent, denyConsent } from 'trackkit';
  ```

* instance:

  ```ts
  const analytics = createAnalytics();
  analytics.grantConsent();
  ```

#### `getConsent(): ConsentStoredState | null`

Returns the current consent state and metadata, or `null` if no consent decision has been recorded. The shape matches the consent storage schema.

Typical fields:

* `status`: `'pending' | 'granted' | 'denied'`
* `version?`: consent policy version
* `method?`: how consent was obtained (e.g. `'banner'`)

#### `grantConsent(): void`

Mark consent as **granted**. This:

* updates stored state,
* unblocks queued analytics events (if your config allows queueing while pending),
* allows future analytics events to be enqueued/sent.

#### `denyConsent(): void`

Mark consent as **denied**. This:

* updates stored state,
* prevents future non-essential events from being queued,
* may still allow “essential” events depending on config (`allowEssentialOnDenied`).

#### `resetConsent(): void`

Reset consent back to its **initial status** (usually `'pending'`), clearing stored decisions.

Useful for debugging or for exposing a “change my consent” option in UI.

#### `onConsentChange(handler: (status: ConsentStatus, prev: ConsentStatus) => void): () => void`

Subscribe to consent changes. Returns an unsubscribe function.

```ts
const unsubscribe = onConsentChange((status, prev) => {
  console.log('Consent changed:', prev, '→', status);
});

// Later:
unsubscribe();
```


### Utilities

#### `waitForReady(opts?: { timeoutMs?: number; mode?: string }): Promise<void>`

Resolves when:

* the provider has initialised **and**
* the initial flush of any queued events has completed

…or rejects after `timeoutMs` (defaulting to a sensible value).

Use this before relying on analytics for critical flows (e.g. blocking funnels in E2E tests).

#### `getFacade(): unknown`

Returns the underlying facade instance used by the singleton.

This is primarily for introspection and advanced integrations. The type is intentionally loose; prefer `getDiagnostics()` for read-only state.

#### `flushIfReady(): Promise<void>`

If the provider is initialised, flush any queued events immediately.

No-op if not ready.

#### `hasQueuedEvents(): boolean`

True if there are events currently buffered in:

* the facade runtime queue, and/or
* the SSR queue (once hydrated).

#### `getDiagnostics(): DiagnosticsSnapshot`

Return a structured snapshot of internal state, including:

* config flags (debug, queue size, autoTrack, DNT, etc.)
* consent status and metadata
* provider key, state, and state history (where supported)
* queue sizes (SSR + runtime)
* last planned and last sent URLs

Used for debugging, visualisation, and tools. See the Debugging guide for field-level details.


### Types

A non-exhaustive list of important exported types:

#### `AnalyticsOptions`

Configuration object passed to `createAnalytics` / `init`.

Includes:

* provider selection (`provider` object with `name` and provider-specific fields)
* queue settings (`queueSize`, `batchSize`, `batchTimeout`, etc.)
* consent options (`initialStatus`, `requireExplicit`, `allowEssentialOnDenied`, etc.)
* resilience and transports (`detectBlockers`, `fallbackStrategy`, `proxy` config)
* behaviour flags (`autoTrack`, `includeHash`, `trackLocalhost`, `doNotTrack`)
* error handling (`onError`)

See the Configuration guide for a field-by-field breakdown.

#### `ProviderType`

String union of supported provider keys, e.g.:

* `'umami'`
* `'plausible'`
* `'ga4'`
* `'noop'`

#### `EventMap` / `AnyEventMap`

* `EventMap`: `Record<string, Record<string, unknown>>` — a mapping from event names to their expected property shapes. Define your own event map to get compile-time checking of `track()` calls via `createAnalytics<E>()`.
* `AnyEventMap`: convenience alias for the fully-open default map. When no type parameter is supplied, `AnyEventMap` is used and all event names and props are accepted.

> **Note:** The singleton API (`init` / `track` / `pageview`) does not support typed events. Use the factory API (`createAnalytics<E>()`) for compile-time event checking.

#### `AnalyticsInstance<E extends EventMap = AnyEventMap>`

The shape of an analytics instance returned by `createAnalytics<E>()`.
Primarily used by TypeScript consumers for typed `track()`.

#### `ConsentStatus`

String union of consent statuses: `'pending' | 'granted' | 'denied'`.

#### `ConsentStoredState`

Persisted consent state structure, used by `getConsent` and `onConsentChange`.

#### `DiagnosticsSnapshot`

Return type of `getDiagnostics()`. Includes:

* `timestamp`, `instanceId`
* `config` (high-level flags)
* `consent` (status, version, method)
* `provider` (key, state, state history)
* `queue` (buffer sizes, capacity)
* `urls` (last planned/sent URLs)

Refer to `facade/diagnostics.ts` for the exact shape.


## SSR module: `trackkit/ssr`

The SSR subpath is used when you need to:

* record events **during server-side rendering**, and
* hydrate those events into the client’s runtime queue.

It **never initialises providers on the server**.

### Server-side event functions

These mirror the main event methods but target the SSR queue instead.

#### `track(eventName: string, props?: Record<string, unknown>): void`

Record a custom event into the SSR queue.

Call this in `getServerSideProps`, `getInitialProps`, or your framework’s SSR hooks:

```ts
import { ssrTrack } from 'trackkit/ssr';

export async function getServerSideProps(ctx) {
  ssrTrack('landing_viewed', { path: ctx.resolvedUrl });
  return { props: {} };
}
```

#### `pageview(path?: string | { path?: string; title?: string; referrer?: string }): void`

Record a SSR pageview event.

```ts
import { pageview as ssrPageview } from 'trackkit/ssr';

export async function getServerSideProps(ctx) {
  ssrPageview(ctx.resolvedUrl || '/');
  return { props: {} };
}
```

#### `identify(userId: string, traits?: Record<string, unknown>): void`

Record a SSR identify event, if you wish to associate the pageview with a user ID at render time.


### SSR queue utilities

These are **advanced** and typically only used in framework integrations or custom SSR setups.

#### `serializeSSRQueue(): string`

Serialize the current SSR queue as a JSON string suitable for embedding into HTML.

Typical usage in a custom `_document` or equivalent:

```tsx
import { serializeSSRQueue } from 'trackkit/ssr';

const queueJson = serializeSSRQueue();

<script
  dangerouslySetInnerHTML={{
    __html: `window.__TRACKKIT_SSR_QUEUE__ = ${queueJson};`,
  }}
/>
```

The client-side facade will hydrate from `window.__TRACKKIT_SSR_QUEUE__` once, then treat the queue as drained.

#### `getSSRQueue(): QueuedEvent[]`

Return the current contents of the SSR queue as an array. Mostly useful in tests.

#### `getSSRQueueLength(): number`

Return the number of events currently buffered in the SSR queue.

Used by diagnostics and advanced monitoring.

#### `enqueueSSREvent(event: QueuedEvent): void`

Low-level API: push a raw queued event into the SSR queue.

Most users should prefer the higher-level `track`, `pageview`, and `identify` SSR helpers.
`enqueueSSREvent` exists for custom integrations, migrations, or when bridging from a legacy analytics system.


## Error handling

Although not a separate module, it’s worth highlighting how errors are surfaced.

### `onError` option (InitOptions)

You can provide a global error handler:

```ts
createAnalytics({
  provider: { name: 'umami', site: 'my-site' },
  onError: (error) => {
    console.error('[trackkit]', error.code, error.message);
    // send to Sentry/Datadog if desired
  },
});
```

Errors are instances of `AnalyticsError` with:

* `code`: an `ErrorCode` (e.g. `'INIT_FAILED'`, `'POLICY_BLOCKED'`, `'QUEUE_OVERFLOW'`)
* `message`: human-readable description
* `provider?`: provider key if relevant
* `timestamp`: when it occurred
* `stack?`: stack trace where available

Refer to `docs/reference/error-codes.md` for the full list.

---

This page is intentionally focused on the **public surface**. For deeper implementation details, see:

* [Configuration guide](/reference/configuration)
* [Consent & privacy guide](/guides/consent-and-privacy)
* [Queue management guide](/guides/queue-management)
* [SSR integration guide](/guides/ssr)
* [Examples section](/examples/overview)
