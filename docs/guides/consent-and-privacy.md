# Consent & Privacy

Trackkit buffers analytics events until consent allows sending (if your policy requires it).

## Consent States

- `pending` (default) — nothing sent, events queued
- `granted` — events flow; queued events are flushed
- `denied` — non-essential events dropped; (optionally) essential events allowed if configured

Essential categories (like `identify`) may still be allowed if configured; non-essential analytics respect the policy.

## Typical Flow

```ts
import { init, grantConsent, denyConsent, track } from 'trackkit';

init({ /* consent policy via env or options */ });

track('signup_click'); // queued if pending

// When user accepts
grantConsent(); // replays queued events

// Or if user declines
denyConsent(); // drops queued analytics events
```

> Trackkit also respects **Do Not Track** by default. Set `doNotTrack: false` to ignore (not recommended).

## Starting state

Default is `pending`. You can change it:

```ts
init({
  consent: {
    initialStatus: 'denied',        // 'pending' | 'denied' | 'granted'
    requireExplicit: true,
    allowEssentialOnDenied: false,
  }
});
```

* `pending`: nothing is sent; events are queued until granted
* `denied`: non-essential events are dropped (not queued)
* `granted`: events flow immediately (use only if you already have consent)

> Only applied when no stored preference exists. The initial state itself is not persisted.

## Provider behavior

* **Umami / Plausible:** cookieless; typical deployments don’t require consent, but Trackkit will still respect your policy.
* **GA4:** commonly requires consent in EU; plan your flow so `grantConsent()` happens only after the user accepts.

## Debugging

Use `debug: true` to see decisions like `consent-pending`, `consent-denied`, and when queues are flushed.
