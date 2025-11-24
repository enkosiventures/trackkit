# Connection & Offline Behaviour

Trackkit includes lightweight primitives for:

- understanding whether the client appears **online**, **offline** or **slow**
- buffering events in memory (and optionally in localStorage)
- draining / clearing queues coherently across SSR + runtime

This guide explains how the connection monitor, offline store, and queues fit together.


## Connection monitoring

Connection monitoring is handled by the `ConnectionMonitor` in `connection/monitor.ts`.

It maintains a simple state machine:

```ts
export type ConnectionState = 'online' | 'offline' | 'slow';
```

### How it decides the state

* On construction:

  * If `window` exists, it registers `online` / `offline` event listeners and starts a periodic check.
  * Initial state is `online` or `offline` based on `navigator.onLine`.

* When your code calls `reportSuccess()`:

  * It records `lastSuccess = Date.now()`.
  * If the previous state was not `online`, it transitions back to `online`.

* When your code calls `reportFailure(err)`:

  * If `navigator.onLine === false`, state becomes `offline`.
  * Otherwise, if the error message contains `"Failed to fetch"`, state becomes `offline` as a hint.
  * Otherwise, if enough time has passed since the last success (`slowThreshold` ms), state becomes `slow`.

* Periodically (every `checkInterval` ms), `checkSlow()` runs:

  * If state is `online` and `now - lastSuccess > slowThreshold * 2`, state becomes `slow`.

Defaults (from the constructor):

* `slowThreshold`: `3000` ms
* `checkInterval`: `30000` ms

You can access the current state and subscribe:

```ts
const monitor = new ConnectionMonitor({ slowThreshold: 3000, checkInterval: 30000 });

monitor.subscribe(state => {
  console.log('Connection state changed:', state);
});

monitor.getState();  // 'online' | 'offline' | 'slow'
monitor.isHealthy(); // true if 'online', false otherwise
```

Call `destroy()` when you’re done to remove event listeners and the interval.

> **Note:** ConnectionMonitor doesn’t send or retry anything by itself; it just tracks state you can use to make decisions.


## Offline buffering

Offline buffering is handled by `OfflineStore` in `connection/offline-store.ts`.

### OfflineEvent format

```ts
export type OfflineEvent = {
  type: EventType;
  args?: any[];
  url?: string;
  category?: ConsentCategory;
  timestamp: number;
};
```

This mirrors the shape of queued façade events (`type`, `args`, `category`, `timestamp`) plus an optional `url`.

### Storage abstraction

Offline storage is abstracted behind an `OfflineStorage` interface:

```ts
export interface OfflineStorage {
  save(events: OfflineEvent[]): void | Promise<void>;
  load(): OfflineEvent[] | Promise<OfflineEvent[]>;
  clear(): void | Promise<void>;
}
```

The default implementation, `LocalStorageStorage`, uses `window.localStorage` when available:

* `save`:

  * loads existing events
  * appends new ones
  * keeps only the **last 1000** (`slice(-1000)`)
  * writes back to `localStorage`

* `load`:

  * parses JSON from localStorage
  * returns `[]` on any error

* `clear`:

  * removes the key from storage

In non-browser environments (`window` or `localStorage` missing), it behaves as a **no-op**, returning empty arrays and doing nothing on `save`/`clear`.

### OfflineStore wrapper

`OfflineStore` is a thin wrapper:

```ts
export class OfflineStore {
  constructor(private storage: OfflineStorage = new LocalStorageStorage()) {}

  async saveOffline(events: OfflineEvent[]) {
    await this.storage.save(events);
  }

  async drainOffline(): Promise<OfflineEvent[]> {
    const events = await this.storage.load();
    if (events.length) await this.storage.clear();
    return events;
  }
}
```

Usage pattern (simplified):

* When you detect “we can’t send right now”:

  * call `offlineStore.saveOffline([...events])` to persist them.
* On the next successful initialisation (with connectivity):

  * call `offlineStore.drainOffline()` and feed returned events into your normal queue.

The maximum retained history is **1000 events** by default.

> Drained offline events re-enter the normal queue and pass through the same consent and policy gates as any other event. If consent is denied at drain time, analytics events are dropped and essential events follow `allowEssentialOnDenied`.


## Runtime queues and SSR

Queue behaviour is implemented by:

* `EventQueue` in `queues/runtime.ts` (runtime façade queue)
* `SSRQueue` in `queues/ssr.ts` (SSR queue, not shown here)
* `QueueService` in `queues/service.ts` (unifies runtime + SSR)

### EventQueue (runtime)

`EventQueue` is a typed queue with consent-awareness and overflow handling:

* `enqueue(type, args, category, pageContext?)`:

  * drops events if the queue is `paused`.
  * deep-clones `args` and `pageContext`.
  * assigns a unique `id` (`evt_<timestamp>_<counter>`).
  * on overflow (`queue.length >= maxSize`):

    * drops the **oldest** events required to make space for the new one.
    * logs a warning (`Queue overflow, dropping N oldest events`).
    * calls `onOverflow(dropped)` if configured.

* `flush()`:

  * returns all queued events.
  * clears the queue.

* `flushEssential()`:

  * returns only events whose `category === 'essential'`.
  * leaves non-essential events in the queue.

* `clear()` / `clearNonEssential()`:

  * `clear()` drops everything and returns how many were dropped.
  * `clearNonEssential()` drops only non-essential events and returns the count.

* `pause()` / `resume()`:

  * `pause()` prevents new events from being enqueued (they are dropped immediately).
  * `resume()` allows events to be queued again.

* State helpers:

  * `getState()` → `{ size, isPaused, oldestEventAge }`
  * `getEvents()` → shallow copy of all queued events (for debugging)
  * `getCapacity()` → `maxSize`
  * `getOverflowHandler()` → the current overflow handler
  * `size` / `isEmpty` getters

On overflow, **newest events are preserved** and oldest are dropped. This is a deliberate choice (documented in code) and aligns with the `QUEUE_OVERFLOW` error semantics.

### QueueService (runtime + SSR)

`QueueService` wraps both runtime and SSR queues:

```ts
export class QueueService {
  private runtime: EventQueue;
  private ssr: IQueue;

  constructor(cfg: QueueConfig) {
    this.runtime = new EventQueue(cfg);
    this.ssr = new SSRQueue();
  }

  enqueue(...)             // runtime-only enqueue
  flushAll()                // SSR.flush() + runtime.flush()
  flushEssential()          // SSR.flushEssential() + runtime.flushEssential()
  clearAll()                // SSR.clear() + runtime.clear()
  clearNonEssential()       // SSR.clearNonEssential() + runtime.clearNonEssential()
  size()                    // runtime.size + ssr.size
  capacity()                // runtime.getCapacity()
  getOverflowHandler()      // runtime.getOverflowHandler()
}
```

The invariants:

* `flushAll()` drains both SSR and runtime queues.
* `flushEssential()` only drains essential events from both queues; non-essential remain queued.
* `size()` reflects total buffered events across both queues.
* `capacity()` reflects the **runtime** queue capacity; SSR queue is not capacity-limited in the same way.

This is what `DiagnosticsService` reports via:

```ts
queue: {
  totalBuffered: runtimeSize + ssrSize,
  ssrQueueBuffered: ssrSize,
  facadeQueueBuffered: runtimeSize,
  capacity: runtimeCapacity,
}
```


## Putting it together: connection, offline, and queues

The intended flow is:

1. **Connection monitor** observes `online` / `offline` / `slow` state.
2. **Queues** buffer events according to consent and queue configuration.
3. **Offline store** optionally persists buffered events when network conditions are bad.
4. When connectivity is healthy again:

   * offline events are drained,
   * queues are flushed,
   * events are sent via the normal dispatcher/resilience pipeline.

Your own app decides:

* when to call `reportSuccess` / `reportFailure` on the monitor,
* when to treat `state === 'slow'` as “stop sending for now” vs “just show a warning”,
* when to save to and drain from `OfflineStore`.

Trackkit’s role is:

* provide a **central queue** with sensible overflow semantics,
* provide a simple connection state primitive,
* provide an offline store abstraction that’s safe in non-browser contexts.


## Example: basic offline-aware setup

Here’s a sketch of how you might connect the pieces in your own app:

```ts
import { createAnalytics } from 'trackkit';
import { ConnectionMonitor } from 'trackkit/connection/monitor';
import { OfflineStore } from 'trackkit/connection/offline-store';

const monitor = new ConnectionMonitor();
const offlineStore = new OfflineStore();

const analytics = createAnalytics({
  provider: 'umami',
  site: '…',
  // normal config…
});

// When you fail to send a batch:
async function onDispatchError(events, err) {
  monitor.reportFailure(err);
  if (!monitor.isHealthy()) {
    await offlineStore.saveOffline(
      events.map(ev => ({
        type: ev.type,
        args: ev.args,
        category: ev.category,
        url: ev.pageContext?.url,
        timestamp: ev.timestamp,
      }))
    );
  }
}

// On init / reconnect:
async function onInit() {
  monitor.reportSuccess();

  const offlineEvents = await offlineStore.drainOffline();
  for (const ev of offlineEvents) {
    analytics.track(ev.type, ...(ev.args || []));
  }
}
```

You don’t have to wire it up exactly like this, but this is the level at which these primitives are intended to be used: **small building blocks**, not a fully automatic offline system.
