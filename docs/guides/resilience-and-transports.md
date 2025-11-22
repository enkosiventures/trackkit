# Resilience & Transports

Trackkit is designed to survive real-world conditions:

- flaky or slow networks
- ad blockers and privacy extensions
- strict CSP and corporate proxies

This guide explains how **retries**, **adblocker detection**, and **transports** work together, and how to configure them.


## Overview

When Trackkit sends an event:

1. It builds a provider-specific payload.
2. It chooses a **transport**:
   - `fetch` (default)
   - `beacon`
   - `proxy` (your own endpoint)
3. It applies **retry logic** if the request fails.
4. It respects **resilience settings** such as adblocker detection and fallback strategy.

You control this via:

- `retry` options (see dispatcher types)
- `resilience` options
- `RETRY_DEFAULTS` and `RESILIENCE_DEFAULTS` in `constants.ts`


## Retry behaviour

Trackkit’s default retry settings (`RETRY_DEFAULTS`) are:

```ts
export const RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelay: 1000,      // ms
  maxDelay: 30000,         // ms
  multiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
} as const;
```

### What this means

* **Up to 3 attempts** (initial try + up to 2 retries).
* **Exponential backoff** starting at 1s, capped at 30s.
* **Jitter** randomises delays slightly to avoid thundering herd.
* Retries only on:

  * `408` (timeout)
  * `429` (rate limited)
  * `500`, `502`, `503`, `504` (transient server errors)

Other HTTP statuses are treated as permanent failures and are **not** retried.

### Customising retries

You can override retry options in your config (see your `InitOptions` / `FacadeOptions`):

```ts
const analytics = createAnalytics({
  provider: 'umami',
  site: '…',
  retry: {
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 60000,
    multiplier: 2,
    jitter: true,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },
});
```

Recommended:

* Use **higher** `maxAttempts` / `maxDelay` for low-volume, high-value events.
* Use **lower** values when latency matters more than “event eventually lands”.


## Adblocker detection

Adblockers often block requests to known analytics endpoints. Trackkit can probe for this and adjust the transport.

Resilience defaults (`RESILIENCE_DEFAULTS`) look like:

```ts
export const RESILIENCE_DEFAULTS = {
  detectBlockers: false,
  fallbackStrategy: 'proxy' as const, // 'proxy' | 'beacon' | 'none'
  proxy: undefined,
} as const;
```

### `detectBlockers`

* `false` (default) → **no detection**, always use the base transport (`fetch`).
* `true` → run an adblocker check at runtime, and if a blocker is detected, choose a fallback transport.

Detection is handled by `dispatcher/adblocker.ts` and typically cached for the session.


## Transports & fallback strategy

Transport resolution (in `dispatcher/transports/resolve.ts`) follows this precedence:

1. Always start with `FetchTransport` as base.
2. If `detectBlockers` is **disabled**, use fetch and return.
3. If `detectBlockers` is **enabled**:

   * If **no blocker** is detected → still use fetch.
   * If a blocker **is** detected:

     1. Determine the **desired fallback**:

        * use `resilience.fallbackStrategy` if set, else
        * use the detector’s suggested fallback, else
        * default to `'proxy'`.
     2. If desired is `'beacon'` → use `BeaconTransport`.
     3. If desired is `'proxy'`:

        * if `resilience.proxy.proxyUrl` is set → use `ProxiedTransport`.
        * otherwise → fall back to `BeaconTransport`.

### Configuring `resilience`

```ts
const analytics = createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',
  resilience: {
    detectBlockers: true,
    fallbackStrategy: 'proxy', // 'proxy' | 'beacon' | 'none'
    proxy: {
      proxyUrl: '/api/trackkit-proxy',
      token: process.env.TRACKKIT_PROXY_TOKEN,
      headers: {
        'X-Trackkit-Source': 'web',
      },
    },
  },
});
```


## Proxy transport

`ProxiedTransport` sends events to your own backend instead of directly to the analytics host:

* Adds an `X-Trackkit-Target` header with the original URL.
* Can add a bearer token and arbitrary headers.
* Forwards selected `fetch` options (e.g. `credentials`, `mode`, `cache`) where supported.

On your backend, you implement the proxy endpoint:

1. Validate request (token, headers).
2. Forward payload to Umami/Plausible/GA4/etc.
3. Apply any additional privacy logic (IP truncation, sampling, etc.).

Benefits:

* Simplified CSP: only need to allow your own domain in `connect-src`.
* Better resilience against adblockers targeting common analytics domains.
* Centralised logging and control over outbound analytics traffic.


## Example strategies

**Baseline / early stage:**

```ts
resilience: {
  detectBlockers: false, // off
}
```

**Blocker-aware, no proxy:**

```ts
resilience: {
  detectBlockers: true,
  fallbackStrategy: 'beacon',
}
```

**Production with proxy:**

```ts
resilience: {
  detectBlockers: true,
  fallbackStrategy: 'proxy',
  proxy: {
    proxyUrl: '/api/trackkit',
    token: '…',
  },
}
```

**Explicitly no fallback:**

```ts
resilience: {
  detectBlockers: true,
  fallbackStrategy: 'none',
}
```

(events simply fail when blocked – rarely desirable, but available).


## Interaction with queues and consent

Resilience concerns **how** events are sent, not whether they *should* be sent.

Rough order of operations:

1. **PolicyGate** decides if sending is allowed:

   * consent (pending / granted / denied)
   * `doNotTrack`
   * localhost policy
   * domain / exclude rules
2. **Queues** buffer events if needed:

   * pre-init / SSR queues
   * runtime facade queue
   * overflow drops oldest events and emits `QUEUE_OVERFLOW`
3. **Resilience / transport** controls actual delivery:

   * which transport (fetch / beacon / proxy)
   * retry strategy
   * behaviour under adblockers

If consent is denied, no transport or retry setting will send anything.
If a queue is full, no transport choice can save the events you’ve chosen to drop.

Use resilience to handle **network and environment issues**, not to bypass policy.
