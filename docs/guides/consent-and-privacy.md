# Consent & Privacy

Trackkit buffers analytics events until consent allows sending (if your policy requires it).

> **Want to see consent controls in action?**
>
> Run the [Consent & Queue Playground](/examples/consent-queue-playground) and watch how consent decisions affect what’s actually enqueued and sent.


## Consent States

- **`pending`** (default) — nothing sent, events queued
- **`granted`** — events flow; queued events are flushed
- **`denied`** — non-essential events dropped; (optionally) essential events allowed if configured

Essential categories (like `identify`) may still be allowed if configured; non-essential analytics respect the policy.


## Consent Categories

Trackkit uses two built-in categories:

- **`essential`** – events that are strictly necessary for the basic operation of your site or service (e.g. critical error reporting, security-related events).
- **`analytics`** – non-essential measurement and product analytics (pageviews, feature usage, funnels, etc).

By default, generic tracking calls (e.g. `analytics.track('signup_completed')`) are treated as `analytics`.  
If you need finer-grained buckets (e.g. `marketing`, `performance`), you can add your own categories, but it is recommended to keep `essential` and `analytics` aligned with these semantics to avoid surprising behaviour.

For how these categories affect actual buffering and dropping behaviour, see [Queue Management](/guides/queue-management).


## Typical Flow

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({ /* consent policy via env or options */ });

analytics.track('signup_click'); // queued if pending

// When user accepts
analytics.grantConsent(); // replays queued events

// Or if user declines
analytics.denyConsent(); // drops queued analytics events
```

> If using singleton helpers, the init, event, and consent functions can be imported and called directly.

> Trackkit also respects **Do Not Track** by default. Set `doNotTrack: false` to ignore (not recommended).


## Starting state

Default is `pending`. You can change it:

```ts
createAnalytics({
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
