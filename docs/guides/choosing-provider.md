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
```


## Provider details

> **Note:** Umami, Plausible, and GA4 all allow for a `site` field in their initialization options that aliases the providers' corresponding site identifier fields (`website`, `domain`, and `measurementId` respectively).

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
createAnalytics({
  provider: 'umami',
  site: 'your-website-id',  // or website: '...'
  host: 'https://analytics.yourdomain.com',  // your Umami host (if not cloud)
  // autoTrack, domains, exclude, etc. as needed
});
```


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
createAnalytics({
  provider: 'plausible',
  site: 'yourdomain.com',  // or domain: '...'
  // host: 'https://plausible.yourdomain.com',  // if self-hosted
  // If your Plausible setup uses revenue goals, send revenue props on events
});
```

> **Revenue:** If you’ve configured revenue goals in Plausible, send revenue/currency in `track()` props; the adapter will forward them appropriately. Exact mapping depends on your Plausible goal setup.


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
createAnalytics({
  provider: 'ga4',
  measurementId: 'G-XXXXXXXXXX',  // or measurementId: '...',
  // apiSecret: 'your-measurement-protocol-secret',  // optional (advanced)
  // autoTrack, defaultProps, etc.
});
```

> GA4 usually sets cookies unless you restrict storage via Consent Mode. Ensure you implement consent correctly for your region.


## Running Multiple Providers

You can run multiple providers at once by creating multiple instances and mirroring the events you care about:

```ts
import { createAnalytics } from 'trackkit';

// Privacy baseline for all users
const baseline = createAnalytics({
  provider: 'plausible',
  site: 'example.com',
});

// Marketing provider (created lazily once consent is granted)
let ga: ReturnType<typeof createAnalytics> | null = null;

export function onMarketingConsent(status: 'pending' | 'granted' | 'denied') {
  if (status === 'granted' && !ga) {
    ga = createAnalytics({
      provider: 'ga4',
      site: 'G-XXXXXXXXXX',
    });
  }

  // optional: drop the GA4 instance (or just leave it dormant)
  if (status === 'denied') {
    ga4 = null;
  }
}

// Helper that mirrors important events into both providers
export function trackSignupCompleted(plan: string) {
  const payload = { plan } as const;

  baseline.track('signup_completed', payload);
  ga?.track('signup_completed', payload);
}
```

> Prefer the singleton helpers? You can mirror in a similar way by calling `init` twice (once per provider) and writing a wrapper `trackSignupCompleted` that calls the global `track` for each config. For anything non-trivial, per-provider instances are easier to reason about.

You can't run more than one provider in a single instance or singleton; instead you compose multiple instances at the app level.

Other patterns:

* **Server-side fan-out:** Send events to your backend and relay to multiple vendors.
* **Feature flags / experiments:** Randomize the provider per user in dev/stage to compare behavior.


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
createAnalytics({ provider, site: 'your-site' });
```


## Recommendations by use case

* **E-commerce** → _**GA4:**_
  * Enhanced e-commerce
  * Audiences
  * Ads integration
  * Attribution

* **Blogs / Marketing sites** → _**Plausible:**_
  * Clean metrics
  * Privacy-first
  * Managed hosting option

* **SaaS / Internal tools (self-hosted)** → _**Umami:**_
  * Data control
  * Cookieless analytics
  * Simple dashboard

* **Landing pages / Campaigns** → _**Plausible:**_
  * Quick setup
  * Lightweight
  * Goal-centric


## Performance

Approximate added payload (gzipped) when the provider is initialized:

* GA4: \~1 kB
* Umami: \~1.5 kB
* Plausible: \~2.5 kB

Trackkit lazy-loads only the selected provider.


## Privacy & compliance

* **Umami / Plausible**: Cookieless by default; many teams operate without a consent banner (verify with your legal counsel).
* **GA4**: Typically requires consent in the EU. Implement consent mode and disclose data collection in your privacy policy.

**CCPA example**

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'your-choice',
  consent: {
    // Treat CCPA opt-out as "denied" from the start
    initialStatus: userIsCalifornia && userOptedOut ? 'denied' : 'pending',
    requireExplicit: false,
  },
});
```

You can also handle this imperatively:

```ts
const analytics = createAnalytics({ provider: 'your-choice' });

if (userIsCalifornia && userOptedOut) {
  analytics.denyConsent();
}
```


## Practical configuration examples

### Domains & excludes

```ts
createAnalytics({
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
const analytics = createAnalytics({
  provider: 'ga4',
  measurementId: 'G-XXXX',
  // Respect browser DNT by default; override only if your policy allows:
  doNotTrack: true,
});

// later, when user consents:
analytics.grantConsent();
```
