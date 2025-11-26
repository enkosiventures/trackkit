# React SPA + Umami Example

This example demonstrates **Trackkit in a client-only Single Page Application**, using:

- the **factory-first instance API** (`createAnalytics`)
- **auto pageview tracking** via the navigation sandbox
- **Umami** as the analytics provider
- `.env.local` runtime configuration
- a simple event (`signup_clicked`) wired to a button

It’s the simplest environment in which Trackkit is used “for real,” and is a good baseline for understanding how the SDK behaves in a pure browser context.

→ [View this example on Github](https://github.com/enkosiventures/trackkit/tree/main/examples/react-spa-umami)


## Goals of This Example

This example illustrates:

### 1. How to initialise Trackkit in a SPA  
The app calls `createAnalytics({...})` in a single shared file so components can import the instance.

### 2. How Trackkit autotrack works with React Router  
URL changes are automatically converted into pageview events.

### 3. How to use Umami via HTTP  
No script tag.  
No global injections.  
Everything is proxied through the Umami API endpoint.

### 4. How `.env.local` affects Trackkit config  
The example loads:

```sh
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=<your-site-id>
VITE_TRACKKIT_HOST=[https://analytics.example.com](https://analytics.example.com)
```

and demonstrates that build-time config → Trackkit instance wiring is reliable.


## Running Locally

1. From the repo root:

```sh
cd examples/react-spa-umami
pnpm install
```

2. Create `.env.local` (git-ignored in the monorepo):

```sh
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=YOUR_SITE_ID
```

3. Start the app:

```sh
pnpm dev
```

4. Open: `http://localhost:5173`


## How the Example Works

### Analytics Initialisation (`src/lib/analytics.ts`)

```ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: import.meta.env.VITE_TRACKKIT_PROVIDER,
  site: import.meta.env.VITE_TRACKKIT_SITE,
  host: import.meta.env.VITE_TRACKKIT_HOST,
  autoTrack: true,
  debug: true,
});
```

Key highlights:

* The instance is created **exactly once**.
* `autoTrack: true` means pageviews are sent when navigation occurs.
* Debug logging is always on for clarity.

### Event Tracking (`App.tsx`)

```ts
<button
  onClick={() => analytics.track('signup_clicked', { source: 'example-app' })}
>
  Sign up
</button>
```

This shows:

* Basic `track()` usage.
* That Trackkit’s queueing and dispatch layers handle the request.

### Why Umami?

Using Umami here shows:

* Scriptless analytics works smoothly.
* Endpoint-based providers integrate cleanly with Trackkit’s transport layer.
* No browser globals required.


## Debugging

Open devtools → Console:

```js
analytics.getDiagnostics()
```

You’ll see queue sizes, URL history, provider metadata, and consent status (defaults to “pending”).


## When to Use This Pattern

Use this architecture when:

* You have a browser-only SPA (Vite, CRA, React Router, etc.)
* You want simple, scriptless tracking
* You want auto pageviews
* You want to wire Trackkit via `.env.local`

If you need SSR or server-recorded pageviews, see the Next.js example.
