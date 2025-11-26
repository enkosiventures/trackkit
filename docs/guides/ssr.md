# Server-Side Rendering (SSR)

Trackkit supports SSR in a strictly queue-only mode.  
This allows you to record events during HTML/template generation without shipping any analytics logic to the server.


## When to use SSR tracking

Use the SSR API when:

- You need *first navigation* events even before client JS loads  
  (e.g. SEO landing pages, server-routed frameworks)
- You want consistent analytics across hybrid render models
- You want deterministic event presence even if hydration is delayed


## What SSR tracking **does not** do

- ❌ **Does NOT initialise providers server-side**  
  No scripts, no network calls, no provider lifecycle.

- ❌ **Does NOT manipulate consent**  
  Consent is evaluated only in the browser.

- ❌ **Does NOT flush or send**  
  Events are serialized into a global queue and replayed by the client.


## How hydration works

During server render:

```ts
import { ssrTrack } from 'trackkit/ssr';

export function renderPage(req) {
  // Track an an event recorded during server-side rendering
  ssrTrack('server_render', { path: req.path });

  const html = renderAppToString(req);
  const head = renderHead();

  return `
    <!doctype html>
    <html>
      <head>
        ${head}
        ${serializeSSRQueue()} <!-- see below -->
      </head>
      <body>
        <div id="root">${html}</div>
        <script src="/client.bundle.js"></script>
      </body>
    </html>
  `;
}
```

In your HTML template:

```ts
import { serializeSSRQueue } from 'trackkit/ssr';

// inside your HTML template builder
head += serializeSSRQueue();  // or {{ serializeSSRQueue() }}
```

This injects:

```html
<script>
  window.__TRACKKIT_SSR_QUEUE__ = [...events...];
</script>
```

On the client:

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'plausible',
  site: 'example.com',
  // same config as on the server
});

// At this point, any events captured during SSR and serialised into
// window.__TRACKKIT_SSR_QUEUE__ are hydrated and replayed (subject to consent).
analytics.pageview(); // client-side navigation
```

**Hydration semantics:**

* The SSR queue is global: `window.__TRACKKIT_SSR_QUEUE__`.
* During client initialization, the SSR queue is hydrated once, replayed once (subject to consent and provider readiness), and then discarded.
* Items are replayed **only if**:

  * Provider is ready, **and**
  * Consent allows analytics events.
* After hydration, the SSR queue is considered empty and never replayed again.
* SSR events preserve their category ([`essential` or `analytics`](/reference/glossary#essential-vs-analytics-events)) and are subject to the same consent and PolicyGate rules as runtime events. Hydration does not bypass consent.

For details on how events are buffered and drained across SSR + runtime queues, see:

- [Queue Management](/guides/queue-management) – overflow semantics, `flushEssential`, and queue trimming.
- [Debugging & Diagnostics](/guides/debugging-and-diagnostics) – inspecting queue sizes and last URLs via `getDiagnostics()`.


## API surface (from `trackkit/ssr`)

```ts
import {
  ssrTrack, ssrPageview, ssrIdentify,
  serializeSSRQueue,
  getSSRQueue, getSSRQueueLength, enqueueSSREvent
} from 'trackkit/ssr';
```

**Notes:**

* `ssrTrack/ssrPageview/ssrIdentify` are SSR variants of the event methods that write to the SSR queue without loading providers or sending network requests.; they only write queue entries.
* `enqueueSSREvent` is an advanced escape hatch for framework authors.
* The SSR queue is separate from the client runtime queue.
