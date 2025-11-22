# Consent Management

Trackkit ships with a lightweight consent layer designed to gate analytics reliably while staying out of your way. It works in browsers, supports SSR hydration, and plays nicely with your own CMP or banner.

* **Default behavior:** nothing is sent until allowed by policy.
* **When consent is denied:** events are dropped (optionally allowing only “essential” events).
* **When consent is pending:** events are queued and flushed on grant.

If you haven’t seen it yet, skim **Configuration → Consent** for env-based config. This page focuses on behavior and usage.


## TL;DR Quick Start

```ts
import { init, grantConsent, denyConsent, onConsentChange, getConsent } from 'trackkit';

const analytics = createAnalytics({
  provider: 'umami',
  site: 'your-site-id',
  consent: {
    initialStatus: 'pending',          // 'pending' | 'granted' | 'denied'
    requireExplicit: true,       // if true, we never auto-promote to granted
    allowEssentialOnDenied: false,
    policyVersion: '2024-01-15',
  },
});

// Show UI if pending
if (analytics.getConsent()?.status === 'pending') showBanner();

// Button handlers
acceptBtn.onclick = () => analytics.grantConsent();
rejectBtn.onclick = () => analytics.denyConsent();

// React to changes
const off = analytics.onConsentChange((status, prev) => {
  if (status === 'granted') hideBanner();
});
```

> Using the singleton API? Replace `analytics.grantConsent()` with `grantConsent()` and skip `createAnalytics`.

> Using a CMP? Just wire your CMP callbacks to `grantConsent()` / `denyConsent()`.


## Consent Model

### States

* **pending**
  No events sent. Events are queued in memory and flushed if consent is later granted.
* **granted**
  All events flow immediately (subject to DNT, domain filters, etc.).
* **denied**
  Non-essential events are dropped (not queued). If `allowEssentialOnDenied` is `true`, **essential** events (like `identify`) still send; otherwise they’re blocked.

### Transitions

* `pending → granted` when you call `grantConsent()` (or implicit grant; see below).
* `pending → denied` when you call `denyConsent()`.
* Any state → `pending` when you call `resetConsent()` or when `policyVersion` changes.

### Essential vs analytics categories

Trackkit internally tags some calls as **essential** (e.g. `identify`) and everything else as **analytics**.

* When `allowEssentialOnDenied = true`, essential events can still be sent after denial (useful for strictly-necessary product telemetry).
* Otherwise, **all** events are blocked on denial.


## Configuration

Keep this minimal at first, then adjust as your policy demands:

```ts
const analytics = createAnalytics({
  consent: {
    /**
     * Initial status at startup. If stored consent exists (and matches policyVersion),
     * the stored value overrides this.
     * @default 'pending'
     */
    initialStatus: 'pending', // 'pending' | 'granted' | 'denied'

    /**
     * If true, Trackkit will NOT auto-promote from pending to granted on first user action.
     * @default true
     */
    requireExplicit: true,

    /**
     * If denied, allow essential events (e.g. identify) to pass.
     * @default false
     */
    allowEssentialOnDenied: false,

    /**
     * Version stamp for your privacy policy. When this changes, stored consent is invalidated
     * and state resets to `initial`.
     */
    policyVersion: '2024-01-15',

    /**
     * Disable localStorage persistence; consent lives only in-memory (resets on reload).
     * @default false
     */
    disablePersistence: false,

    /**
     * Storage key if you need to customize it.
     * @default '__trackkit_consent__'
     */
    storageKey: '__trackkit_consent__',
  }
});
```

**Implicit consent (opt-out models):**
If you set `requireExplicit: false` and keep `initialStatus: 'pending'`, the first **analytics** event during a genuine user interaction can auto-promote to **granted**. (This promotion never happens if you keep `requireExplicit: true`.)

> For environment-based config of consent (e.g., `VITE_TRACKKIT_CONSENT`), see **API → Configuration**.


## Runtime API

```ts
import {
  getConsent,            // -> { status: 'pending'|'granted'|'denied', updatedAt, policyVersion, ... }
  grantConsent,
  denyConsent,
  resetConsent,          // resets to 'pending' and clears stored value
  onConsentChange        // (status, previousStatus) => void; returns unsubscribe fn
} from 'trackkit';
```

* **`getConsent()`** — inspect current status and counters (queued & dropped).
* **`grantConsent()`** — sets status to **granted**, flushes any queued events.
* **`denyConsent()`** — sets status to **denied**, clears queued analytics events; essential behavior depends on `allowEssentialOnDenied`.
* **`resetConsent()`** — clears stored consent (if any), sets **pending**.
* **`onConsentChange()`** — subscribe to changes (useful to lazily load other tools after grant).


## Typical Patterns

### 1. Explicit banner (GDPR-style)

```ts
const analytics = ({ consent: { initial: 'pending', requireExplicit: true } });

if (getConsent()?.status === 'pending') showBanner();

accept.onclick = () => grantConsent();
reject.onclick = () => denyConsent();
```

### 2. Implicit grant on first interaction (opt-out)

```ts
const analytics = ({
  consent: { initial: 'pending', requireExplicit: false },
});
// First analytics event after user interacts can auto-promote to 'granted'.
// (Never auto-promotes if requireExplicit is true.)
```

### 3. Policy version bumps (force re-consent)

```ts
const analytics = ({
  consent: { policyVersion: '2024-10-01', initial: 'pending' },
});
// If stored policyVersion differs, consent resets to 'pending'.
```

### 4. Load third-party tools only after grant

```ts
analytics.onConsentChange((status) => {
  if (status === 'granted') {
    import('./pixels/facebook').then(m => m.init());
    import('./hotjar').then(m => m.init());
  }
});
```

### 5. SSR

* On the server, consent is effectively **pending**; events go into the SSR queue.
* On the client, Trackkit hydrates SSR events and **gates them through consent** before sending.
* If consent remains pending or denied on the client, SSR events won’t leak.


## How Consent Interacts with Other Policies

* **Do Not Track (DNT):** If `doNotTrack` is enabled (default), DNT can block sends even if consent is granted. You can disable DNT enforcement via `createAnalytics({ doNotTrack: false })` if your policy allows.
* **Domain/URL Filters:** `domains` and `exclude` still apply after consent is granted.
* **Localhost:** If `trackLocalhost` is `false`, nothing sends on localhost even when consent is granted (unless you override).


## Diagnostics & Debugging

* **Enable debug logs:** `createAnalytics({ debug: true })` to trace consent decisions and queue behavior.
* **At runtime:**

  ```ts
  console.log(getConsent()); // status, queued count, dropped count
  ```
* **Storage unavailable?** If localStorage is disabled/restricted, Trackkit falls back to memory-only behavior if `disablePersistence` is true; otherwise consent may not persist across reloads.

Common symptoms & checks:

* **“Events aren’t sending”** → `getConsent().status` must be `granted`. Pending queues; denied drops.
* **“My identify still sends after denial”** → Set `allowEssentialOnDenied: false`.
* **“Users weren’t re-asked after policy update”** → Ensure `policyVersion` changed and persistence is enabled.


## Minimal CMP Integration

Hook your CMP’s callbacks straight into your analytics instance:

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'ga4',
  site: 'G-XXXXXXXXXX',
  consent: { initialStatus: 'pending', requireExplicit: true },
});

cmp.on('consent:granted', () => analytics.grantConsent());
cmp.on('consent:denied',  () => analytics.denyConsent());
cmp.on('consent:reset',   () => analytics.resetConsent());
```

> Using the singleton helpers instead? Import `grantConsent` / `denyConsent` / `resetConsent` from `'trackkit'` and call them directly.

If your CMP provides granular categories, gate calls accordingly and keep Trackkit’s consent **strict** (e.g., `requireExplicit: true`, `initialStatus: 'pending'`). Trackkit’s own categories are minimal (essential vs analytics); you can still decide at your UI layer which calls to make.


## Testing Consent Behavior

* **Unit/integration tests:** simulate each initial state and verify queue/flush/drop:

  * `initial: 'pending'` → queue, then `grantConsent()` → flush
  * `initial: 'denied'` with/without `allowEssentialOnDenied` → drop/allow essential
  * `policyVersion` bump → stored consent invalidated → back to `pending`
* Use small `await Promise.resolve()` (or a short `setTimeout(0)`) to let async flushes complete.


## Best Practices

1. **Default to explicit consent** unless your legal basis differs (`requireExplicit: true`, `initial: 'pending'`).
2. **Version your policy** and rotate `policyVersion` when language meaningfully changes.
3. **Don’t rely on auto-promotion** if you need an auditable explicit signal.
4. **Load extras after grant** (pixels, replayers) via `onConsentChange`.
5. **Keep the UI obvious** and accessible; make “reject” as easy as “accept”.


### Where to go next

* **Configuration reference:** environment-driven consent config, defaults, and examples.
* **Queue Management:** deeper dive into pending/flush semantics and SSR hydration.
* **Provider Guides:** see how each adapter behaves under consent (e.g., identify being essential).

If anything in this doc conflicts with your legal requirements, defer to your counsel and tune the options accordingly.
