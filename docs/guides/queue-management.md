# Queue Management

Trackkit buffers events when it’s *not safe* to send yet, then replays them in order once conditions are met.

## When We Queue

1) **Provider not ready (async load)**
```ts
init({ provider: 'umami' });
// Immediately
track('clicked');
// If provider still initializing, this event is queued.
```

2. **Consent pending**

```ts
init({ /* consent defaults to "pending" in your policy */ });
track('signup_submit'); // queued
grantConsent();         // flushes the queue in order
```

3. **SSR hydration**

* Events collected on the server are injected into the page and **replayed** after the provider is ready and consent allows it.

> Best practice: call `init()` as early as possible on the client. Pre-init calls in the browser are not guaranteed to buffer unless an instance has been created.

---

## Configuring the Queue

```ts
init({
  queueSize: 100, // default 50
  onError: (err) => {
    if (err.code === 'QUEUE_OVERFLOW') {
      console.warn('Analytics queue full; oldest events dropped');
    }
  },
});
```

When the in-memory queue exceeds `queueSize`, Trackkit drops oldest events and emits a single `QUEUE_OVERFLOW` error describing what was dropped.

---

## Observability

Use the public diagnostics surface:

```ts
const analytics = init({ debug: true });

const diag = analytics.getDiagnostics();
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

---

## SSR Flow

On the **server**, collect events and serialize into the HTML (using your helper or API):

```ts
// Server
import { track /*, serializeSSRQueue */ } from 'trackkit/ssr';

track('server_render', { route: '/product/123' });

// In your template <head>:
${/* serializeSSRQueue() or your equivalent */''}
```

On the **client**, Trackkit automatically hydrates and replays SSR events *after* the provider is ready and consent allows it. If consent is pending, SSR events are held until consent is granted.

> If you’re not using a helper, ensure you inject a script tag that initializes the SSR queue in the shape Trackkit expects. See the SSR guide for examples.
