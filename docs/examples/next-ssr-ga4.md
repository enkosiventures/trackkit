# Next.js SSR + GA4 Example

This example demonstrates how to use Trackkit in a **server-rendered app (Next.js)** where:

- pageviews are sent **on the server** using `trackkit/ssr`
- the SSR queue is shipped to the browser during hydration
- GA4 is used as the client-side provider
- a shared client instance consumes SSR events on load

It is the canonical “real app” SSR integration pattern.

→ [View this example on Github](https://github.com/enkosiventures/trackkit/tree/main/examples/next-ssr-ga4)


## Goals of This Example

### 1. Show true SSR pageview tracking  
`trackkit/ssr` writes queue entries but **never initialises providers** on the server.

### 2. Demonstrate SSR queue hydration  
Events collected server-side are injected into HTML as:

```js
window.__TRACKKIT_SSR_QUEUE__ = [...]
```

The client instance consumes them exactly once.

### 3. Demonstrate a GA4 client integration

Using `NEXT_PUBLIC_GA4_MEASUREMENT_ID`

### 4. Show how Trackkit interacts with Next.js lifecycles

Including:

* `getServerSideProps`
* `_document.tsx`
* client-side instance creation


## Running Locally

1. From the repo root:

```bash
cd examples/next-ssr-ga4
pnpm install
```

2. Create `.env.local`:

```sh
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

3. Start:

```sh
pnpm dev
```

4. Visit `http://localhost:3000`


## How the Example Works

### Server-side pageview (`pages/index.tsx`)

```ts
import { pageview } from 'trackkit/ssr';

export const getServerSideProps = async (ctx) => {
  pageview(ctx.resolvedUrl || '/');
  return { props: {} };
};
```

This demonstrates:

* SSR pageviews are written to the SSR queue.
* No provider is running on the server.
* Queue entries accumulate per request only.

### Hydration of SSR queue (`_document.tsx`)

```tsx
import { serializeSSRQueue } from 'trackkit/ssr';

const ssrQueue = serializeSSRQueue();
<script dangerouslySetInnerHTML={{
  __html: `window.__TRACKKIT_SSR_QUEUE__ = ${ssrQueue};`
}} />
```

This is the official pipeline:

1. Server records events into the SSR queue.
2. They’re serialized into HTML.
3. On the browser, Trackkit hydrates them into the runtime queue.
4. First `analytics.track()` flushes them out to the provider.

### Client analytics instance (`lib/analytics.ts`)

```ts
import { createAnalytics } from 'trackkit';

export const analytics = typeof window !== 'undefined'
  ? createAnalytics({
      provider: 'ga4',
      measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
      autoTrack: true,
      debug: true
    })
  : null;
```

The client consumes the SSR queue via the facade during initialisation.

### Event tracking in the browser

```ts
<button
  onClick={() => analytics?.track('signup_clicked')}
>
  Sign up
</button>
```

Trackkit handles:

* queue addition
* dispatch
* GA4 payload formatting
* network timing metrics


## Debugging

In devtools:

```js
analytics.getDiagnostics()
```

You’ll see:

* provider reports (`ga4`)
* queue sizes
* lastPlanned / lastSent URLs
* consent state
* SSR events merged with runtime queue


## When to Use This Pattern

Use this structure when:

* You need **server-recorded pageviews**
* You run **Next.js or another SSR framework**
* You use **GA4** or any provider that injects script tags
* You want clean separation of server queue → client hydration
