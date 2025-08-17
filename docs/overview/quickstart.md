# Quickstart

Install, initialize, and send your first event in under 2 minutes.

## 1) Install

```bash
pnpm add trackkit
# or
npm i trackkit
# or
yarn add trackkit
````

## 2) Configure

Set environment variables or inject at runtime.

**.env**

```env
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=your-site-id
TRACKKIT_HOST=https://analytics.example.com
TRACKKIT_DEBUG=true
```

## 3) Initialize early

```ts
// main.ts
import { init } from 'trackkit';

init({
  // programmatic overrides go here (optional)
  autoTrack: true, // enable SPA navigation tracking
});
```

## 4) Track

```ts
import { track, pageview, identify } from 'trackkit';

track('signup_submit', { plan: 'pro' });
pageview(); // manually if autoTrack is off
identify('user_123');
```

## 5) Consent

If your policy starts as “pending”, flush on grant:

```ts
import { grantConsent, denyConsent } from 'trackkit';

grantConsent(); // queued events are flushed
// denyConsent(); // queued analytics events are cleared
```

## 6) Verify

Enable debug logs and inspect:

```ts
const diag = init({ debug: true }).getDiagnostics();
console.log(diag.providerReady, diag.consent); // e.g. true, 'granted'
```

You’re done. Check the **Choosing a Provider** and migration guides for provider-specific tips.
