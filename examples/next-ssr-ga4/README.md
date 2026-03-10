# Next.js SSR + GA4 via Trackkit

Demonstrates server-side rendering with Trackkit's SSR API and GA4 (Measurement Protocol).

## What this example shows

- **SSR event collection** — `ssrPageview()` and `ssrTrack()` run inside `getServerSideProps` and enqueue events into `globalThis.__TRACKKIT_SSR_QUEUE__` without initialising a provider or making network calls.
- **HTML injection** — a custom `_document.tsx` captures the SSR queue in `getInitialProps` and injects it as a `<script>` tag so the client SDK can hydrate it.
- **Client hydration** — the client-side `createAnalytics()` instance picks up the injected queue automatically and replays server events through GA4 alongside any client events.
- **Client tracking** — a "Track Event" button fires `analytics.track()` on the client to demonstrate client-side events merging with the hydrated SSR queue.

## Key files

| File | Role |
|------|------|
| `lib/analytics.ts` | Creates the GA4 analytics instance (client-only, guarded by `typeof window`) |
| `pages/_app.tsx` | Wraps all pages; exposes the analytics instance on `window` for debugging |
| `pages/index.tsx` | Calls `ssrPageview()` and `ssrTrack()` in `getServerSideProps`; renders a split-view showing server vs client events |
| `pages/_document.tsx` | Captures and injects `__TRACKKIT_SSR_QUEUE__` into the HTML |

## Setup

```bash
cd examples/next-ssr-ga4
pnpm install
```

Create a `.env.local`:

```bash
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The page renders server-side events on the left panel and lets you fire client events on the right. Check the Network tab to see events sent to GA4.

## SSR guarantees

The SSR API (`trackkit/ssr`) is designed to be safe in server contexts:

- **Does NOT initialise providers** — `ssrTrack` / `ssrPageview` / `ssrIdentify` only push to an in-memory queue.
- **Does NOT manipulate consent** — consent state is a client concern; server calls accept a category but never read or write consent.
- **Does NOT flush or send** — `flushSSRAll()` is a no-op on the server (`if (!hasDOM()) return []`). Flushing only happens client-side during hydration.
