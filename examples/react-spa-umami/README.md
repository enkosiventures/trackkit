# React SPA + Umami via Trackkit

Demonstrates a client-side React app using Trackkit with Umami as the analytics provider, including consent management and automatic page tracking.

## What this example shows

- **Auto-tracking** — `autoTrack: true` listens for `pushState` / `popstate` and sends pageviews automatically as you navigate between routes. No manual `pageview()` calls needed.
- **Consent flow** — analytics starts with `initialStatus: 'pending'` and `requireExplicit: true`. Events queue locally until the user interacts with the consent banner (`ConsentBanner.tsx`).
- **Custom events** — the Pricing page fires `analytics.track('signup_clicked', { plan, source })` on button click.
- **Umami adapter** — cookieless by default, no remote `<script>` tag; all data is sent via `fetch`.

## Key files

| File | Role |
|------|------|
| `src/analytics.ts` | Creates the Umami analytics instance with consent pending |
| `src/App.tsx` | Simple SPA router with three pages; demonstrates auto-tracking and custom events |
| `src/ConsentBanner.tsx` | Subscribes to consent state and calls `grantConsent()` / `denyConsent()` |
| `src/main.tsx` | React entry point; exposes analytics on `window` for debugging |

## Setup

```bash
cd examples/react-spa-umami
pnpm install
```

Create a `.env.local`:

```bash
VITE_UMAMI_SITE=<your-umami-site-id>
VITE_UMAMI_HOST=https://cloud.umami.is    # or your self-hosted domain
```

## Run

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and click around. A consent banner appears at the bottom — events queue locally until you accept. Navigate between Home, Features, and Pricing to see auto-tracked pageviews. Click the signup button on the Pricing page to fire a custom event.

Inspect `window.__analytics.getDiagnostics()` in the console to see queued events, provider state, and consent status.

