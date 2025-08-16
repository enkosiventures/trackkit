# Choosing an Analytics Provider

Trackkit supports multiple analytics providers behind one stable API. This guide helps you pick the best fit for your product and constraints.

## At-a-glance comparison

| Feature | Umami | Plausible | Google Analytics 4 |
|--------|:-----:|:---------:|:------------------:|
| **Privacy-first** | ✅ | ✅ | ⚠️ Requires consent (EU) |
| **Cookieless by default** | ✅ | ✅ | ❌ (can limit cookies via Consent Mode) |
| **Open source** | ✅ | ✅ | ❌ |
| **Self-hosting** | ✅ | ✅ | ❌ |
| **Cost (hosted)** | N/A (self-host) | Paid plans | Free tier (limits apply) |
| **User-level tracking** | ❌ | ❌ | ✅ |
| **Custom events** | ✅ | ✅ (Goals) | ✅ |
| **Revenue tracking** | ⚠️ via custom events | ✅ via goals (if enabled) | ✅ |
| **Realtime** | ✅ | Near-realtime (slight delay) | ✅ |
| **Data retention** | Your DB (unlimited if self-host) | Your DB (self-host) / vendor policy (cloud) | Configurable (typ. up to 14 months) |
| **Adapter size (approx.)** | ~1.5 kB | ~2.5 kB | ~1 kB |

> Sizes are Trackkit adapter budgets, not exact byte counts.

---

## Decision guide

```

Need user-level analytics (user journeys, audiences)?
├─ Yes → Google Analytics 4 (GA4)
└─ No → Is strict privacy & data control a priority?
├─ Yes → Will you self-host?
│   ├─ Yes → Umami
│   └─ No  → Plausible (hosted)
└─ No  → Prefer deeper features/Google Ads integration?
├─ Yes → GA4
└─ No  → Plausible (simplest path)

````

---

## Provider details

### Umami

**Best for:** Privacy-conscious sites and SaaS apps that want full control and self-hosting.

**Pros**
- Full data ownership
- Cookieless by default
- Lightweight script + simple UI
- Realtime metrics

**Cons**
- You run and maintain the stack
- Fewer built-in marketing features
- No user-level tracking

**Trackkit config**
```ts
init({
  provider: 'umami',
  site: 'your-website-id',             // aka "website"
  host: 'https://analytics.yourdomain.com', // your Umami host (if not cloud)
  // autoTrack, domains, exclude, etc. as needed
});
````

---

### Plausible

**Best for:** Privacy-focused sites that prefer managed hosting (or advanced self-hosting).

**Pros**

* GDPR-friendly defaults, cookieless
* Goals & (optional) revenue tracking
* Clean, focused UI
* Hosted or self-hosted

**Cons**

* Hosted plans are paid
* Slight delay on dashboards
* No user-level tracking

**Trackkit config**

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  // host: 'https://plausible.yourdomain.com', // if self-hosted
  // If your Plausible setup uses revenue goals, send revenue props on events
});
```

> **Revenue:** If you’ve configured revenue goals in Plausible, send revenue/currency in `track()` props; the adapter will forward them appropriately. Exact mapping depends on your Plausible goal setup.

---

### Google Analytics 4 (GA4)

**Best for:** Products needing user journeys, advanced segmentation, Google Ads integration, and ML-powered insights.

**Pros**

* Rich analysis, audiences, and funnels
* Tight Google Ads/Marketing integration
* Generous free tier
* Realtime

**Cons**

* Privacy/consent management required (esp. EU)
* Interface complexity & learning curve
* Sampling/limits on free tier

**Trackkit config**

```ts
init({
  provider: 'ga4',
  measurementId: 'G-XXXXXXXXXX', // required
  // apiSecret: 'your-measurement-protocol-secret', // optional (advanced)
  // autoTrack, defaultProps, etc.
});
```

> GA4 usually sets cookies unless you restrict storage via Consent Mode. Ensure you implement consent correctly for your region.

---

## “Can I run more than one provider?”

**Stage 6:** Trackkit supports **one active provider per SDK instance**.
Running two providers simultaneously via the same singleton is not supported.

**Common workarounds**

* **Server-side fan-out:** Send events to your backend and relay to multiple vendors.
* **App-level composition:** If/when Trackkit exposes multi-instance APIs, you can initialize two facades and call both. (Roadmap item—watch the repo.)

---

## Migration notes

### From Universal Analytics → GA4

* GA4’s data model is **event-based**; expect renaming/remapping.
* Measurement IDs use the `G-` prefix.
* Some metrics differ; historical UA data won’t carry over.

### From GA4 → privacy-first (Plausible / Umami)

* Lower user counts (no user-level tracking)
* Simpler reports, faster load
* Easier consent story

**Testing**

```ts
// A/B test providers (dev/stage only)
const provider = Math.random() > 0.5 ? 'plausible' : 'umami';
init({ provider, site: 'your-site' });
```

---

## Recommendations by use case

* **E-commerce** → **GA4**
  Enhanced e-commerce, audiences, Ads integration, attribution

* **Blogs / Marketing sites** → **Plausible**
  Clean metrics, privacy-first, managed hosting option

* **SaaS / Internal tools (self-hosted)** → **Umami**
  Data control, cookieless analytics, simple dashboard

* **Landing pages / Campaigns** → **Plausible**
  Quick setup, lightweight, goal-centric

---

## Performance

Approximate added payload (gzipped) when the provider is initialized:

* GA4: \~1 kB
* Umami: \~1.5 kB
* Plausible: \~2.5 kB

Trackkit lazy-loads only the selected provider.

---

## Privacy & compliance

* **Umami / Plausible**: Cookieless by default; many teams operate without a consent banner (verify with your legal counsel).
* **GA4**: Typically requires consent in the EU. Implement consent mode and disclose data collection in your privacy policy.

**CCPA example**

```ts
if (userIsCalifornia && userOptedOut) {
  // Skip init entirely
} else {
  init({ provider: 'your-choice' });
}
```

---

## Practical configuration examples

### Domains & excludes

```ts
init({
  provider: 'plausible',
  site: 'example.com',
  domains: ['example.com', 'www.example.com'],     // allowlist
  exclude: ['/admin', '/preview'],                 // drop matches
  autoTrack: true,                                 // SPA nav
  includeHash: false,                              // strip #hash
});
```

### GA4 with consent

```ts
init({
  provider: 'ga4',
  measurementId: 'G-XXXX',
  // Respect browser DNT by default; override only if your policy allows:
  doNotTrack: true,
});

// later, when user consents:
grantConsent();
```
