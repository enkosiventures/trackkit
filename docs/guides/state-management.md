# Provider State Management

Trackkit wraps each provider with a small state machine for reliable lifecycle management.

```
idle → initializing → ready → destroyed
```

- **idle** – Constructed but not loading yet
- **initializing** – Provider is loading/bootstrapping
- **ready** – Provider can accept events immediately
- **destroyed** – Terminal state; instance cleaned up

> When a provider **fails** to initialize, Trackkit logs an error and **falls back to the `noop` provider**, so your app code doesn’t crash.

> This guide uses the **singleton helpers** (`init`, `waitForReady`, …) for brevity.
> The underlying state machine and diagnostics are the same for instances created via `createAnalytics()`.


## Waiting for Ready

```ts
import { init, waitForReady } from 'trackkit';

init({ provider: 'umami' });
await waitForReady();   // ensures provider is ready
track('app_loaded');
```

You don’t have to wait—calls are automatically queued until ready—but `waitForReady()` is useful when you need deterministic behavior (e.g., tests).


## Inspecting State

Prefer the diagnostics surface over internal state (whether you use an instance or the singleton):

```ts
const { providerReady, provider } = init({ debug: true }).getDiagnostics();

console.log(providerReady); // true/false
console.log(provider);      // 'umami' | 'plausible' | 'ga4' | 'noop'
```


## Error Recovery & Fallback

If initialization fails (bad config, blocked script, network), Trackkit:

1. Emits an `INIT_FAILED` error (to your `onError` callback).
2. Falls back to the **no-op provider**.
3. Keeps your public API operational (methods won’t throw).


## Destroy & Re-init

```ts
import { destroy, init } from 'trackkit';

destroy(); // stop autotrack, clear queues, destroy provider
init({ provider: 'plausible', autoTrack: true });
```

Destroying cleans navigation listeners, clears in-memory queues, resets consent listeners, and detaches the provider. Re-init is safe afterwards.


## (Optional) Preloading

If you ship your own preload step (dynamic import), do it before `init()`:

```ts
await import('trackkit/providers/umami'); // warm the chunk
init({ provider: 'umami' });
```

> Trackkit doesn’t currently export a dedicated `preload()` helper; this pattern is sufficient if you need it.
