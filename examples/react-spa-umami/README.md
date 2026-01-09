# React SPA + Umami via Trackkit

Minimal example showing how to use Trackkit in a Vite + React SPA with Umami.

## Setup

```bash
cd examples/react-spa-umami

# if you haven't created the app yet:
# pnpm create vite . --template react-ts

pnpm install
````

Create a `.env.local`:

```bash
VITE_UMAMI_SITE=<your-umami-site-id>
VITE_UMAMI_HOST=https://cloud.umami.is    # or your self-hosted domain
```

## Run

```bash
pnpm dev
```

Then visit [http://localhost:5173](http://localhost:5173) and click around.
Trackkit will send pageviews (via `autoTrack`) and a custom event on button click.
