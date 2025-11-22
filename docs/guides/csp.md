# Content Security Policy (CSP)

CSP rules depend on the provider.

## Umami & Plausible (no external scripts)

Allow network calls to your analytics endpoint:

```
connect-src 'self' [https://analytics.example.com](https://analytics.example.com);
```

If you inject runtime config via `window.__TRACKKIT_ENV__`, ensure your HTML templating avoids XSS risks.

## Google Analytics 4 (loads gtag.js)

```
script-src [https://www.googletagmanager.com](https://www.googletagmanager.com);
connect-src [https://www.google-analytics.com](https://www.google-analytics.com) [https://region1.google-analytics.com](https://region1.google-analytics.com);
```

Exact domains may vary; consult Google’s docs.

## General

- Prefer `connect-src` over adding external trackers to `script-src` where possible.
- Keep `debug: false` in production to minimize console spill.
- Consider a first-party proxy in Stage 7+ if you need to hide vendor origins.
