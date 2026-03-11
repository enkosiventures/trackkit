---
title: "Analytics Resilience: Proxy Transport, Adblocker Detection, and Retry"
description: "How Trackkit handles hostile browser environments — adblocker fallbacks, beacon vs fetch transport, first-party proxy mode, and retry with backoff."
---
# Resilience & Transports

Trackkit is designed to survive real-world conditions:

- flaky or slow networks
- ad blockers and privacy extensions
- strict CSP and corporate proxies

This guide explains how **retries**, **adblocker detection**, and **transports** work together, and how to configure them.

## Overview

When Trackkit dispatches an event:

1. It builds a provider-specific payload.
2. It **resolves the transport** based on your configuration and environment:
   - Checks `transportMode` (fetch vs beacon).
   - If enabled, runs **adblocker detection** and switches to a fallback strategy (e.g. proxy) if needed.
3. It hands the request to the transport, which applies **retry logic** (backoff/jitter) if the request fails.

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

You can override retry options via `dispatcher.resilience.retry` in your `AnalyticsOptions`:

```ts
const analytics = createAnalytics({
  provider: {
    name: 'umami',
    site: '…',
  },
  dispatcher: {
    resilience: {
      retry: {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 60000,
        multiplier: 2,
        jitter: true,
        retryableStatuses: [408, 429, 500, 502, 503, 504],
      },
    },
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
  fallbackStrategy: 'proxy' as const, // 'proxy' | 'beacon'
  proxy: undefined,
  retry: { /* see RETRY_DEFAULTS above */ },
} as const;
```

### `detectBlockers`

* `false` (default) → **no detection**, always use the base transport (`fetch`).
* `true` → run an adblocker check at runtime, and if a blocker is detected, choose a fallback transport.

Detection is handled by `dispatcher/adblocker.ts` and typically cached for the session.

## Transports & fallback strategy

Transport resolution (in resolve.ts) determines which low-level mechanism (`fetch` vs `beacon`) or endpoint (direct vs proxy) to use.

1. **Check Base Transport**: Uses `FetchTransport` by default.
2. **Check Blockers**:
   - If `detectBlockers` is **disabled**, proceed with base transport.
   - If `detectBlockers` is **enabled**, run a probe.
     - If **no blocker** detected → proceed with base transport.
     - If a blocker **is** detected → resolve the **fallback strategy**.

### Fallback Strategies

If a blocker is detected, Trackkit chooses a fallback based on `dispatcher.resilience.fallbackStrategy`:

* `'proxy'` (default): forces usage of `ProxiedTransport`. **Throws a configuration error** if `proxyUrl` is missing. Use this to ensure you don't accidentally send direct requests if proxying fails.
* `'beacon'`: forces usage of `BeaconTransport`.

If you want no fallback at all, simply leave `detectBlockers: false` (the default). When blocker detection is disabled, Trackkit always uses the base transport (`FetchTransport`) regardless of `fallbackStrategy`.

> **Note:** The default `transportMode` is `'smart'`, which handles the overall transport selection logic. `fallbackStrategy` only applies when `detectBlockers: true` *and* a blocker is detected.

### Configuring `resilience`

Resilience options live under `dispatcher.resilience` in your `AnalyticsOptions`:

```ts
const analytics = createAnalytics({
  provider: { name: 'plausible', site: 'yourdomain.com' },
  dispatcher: {
    resilience: {
      detectBlockers: true,
      fallbackStrategy: 'proxy', // 'proxy' | 'beacon'
      proxy: {
        proxyUrl: '/api/trackkit-proxy',
        token: process.env.TRACKKIT_PROXY_TOKEN,
        headers: {
          'X-Trackkit-Source': 'web',
        },
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

All `resilience` options live under `dispatcher.resilience`:

**Baseline / early stage:**

```ts
dispatcher: {
  resilience: {
    detectBlockers: false, // off (default)
  },
}
```

**Blocker-aware, no proxy:**

```ts
dispatcher: {
  resilience: {
    detectBlockers: true,
    fallbackStrategy: 'beacon',
  },
}
```

**Production with proxy:**

```ts
dispatcher: {
  resilience: {
    detectBlockers: true,
    fallbackStrategy: 'proxy', // Throws if proxy config missing
    proxy: {
      proxyUrl: '/api/trackkit',
      token: '…',
    },
  },
}
```

**No fallback (default transport only):**

```ts
// Simply leave detectBlockers: false (the default).
// Trackkit always uses FetchTransport; no blocker detection runs.
dispatcher: {
  resilience: {
    detectBlockers: false,
  },
}
```

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

If consent is denied or policy gates block, no transport or retry setting will send anything.
If a queue is full, no transport choice can save the events you’ve chosen to drop.

Use resilience to handle **network and environment issues**, not to bypass policy.