# Content Security Policy (CSP)

CSP rules depend on the provider.

## Umami & Plausible (no external scripts)

Allow network calls to your analytics endpoint:

```
connect-src 'self' [https://analytics.example.com](https://analytics.example.com);
```

If you inject runtime config via `window.__TRACKKIT_ENV__`, ensure your HTML templating avoids XSS risks.

## Google Analytics 4 (loads gtag.js)

Trackkit sends GA4 events via the **Measurement Protocol only**.
No GA script (gtag.js) is loaded by default.
Your CSP only needs GA4’s **analytics endpoints** in `connect-src`:

```
connect-src https://www.google-analytics.com https://region1.google-analytics.com;
```

If you intentionally choose to load gtag.js yourself (optional, advanced), then add:

```
script-src https://www.googletagmanager.com;
```

## General

- Prefer `connect-src` over adding external trackers to `script-src` where possible.
- Keep `debug: false` in production to minimize console spill.
- For production environments, consider sending analytics through a [**first-party proxy**](/guides/resilience-and-transports#proxy-transport) to simplify CSP and reduce adblocker interference.
- Trackkit loads no remote scripts for Umami/Plausible; only network calls are required (`connect-src`). All configuration is handled in your bundle.
