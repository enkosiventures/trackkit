# What is Trackkit?

Trackkit is a tiny, privacy-first analytics SDK designed for modern apps:

- **No remote scripts** — everything ships in your bundle.
- **Consent-aware** — GDPR-friendly defaults with essential/analytics separation.
- **SSR-aware** — queue on the server, hydrate on the client.
- **Multi-provider** — Umami, Plausible, GA4, or custom adapters.
- **Queue-first runtime** — deterministic behaviour regardless of consent, network, or ad blockers.
- **DX-focused** — typed API, diagnostics, provider state introspection.

Trackkit aims to be the *thin* layer between your application and your analytics, giving you:

- A unified API  
- Predictable queue logic  
- Provider abstraction  
- Strong CSP/MV3 compatibility  
- Optional batching, resilience, offline buffering, and performance metrics

> Supported providers in v0.x: Umami, Plausible, GA4.
> Other providers can be integrated [via the adapter API](/guides/custom-providers).

## Try it now!

Visit the **[Trackkit playground](/overview/playground)**.


## Why should you use Trackkit?

You do **not** need Trackkit if:

- you’re happy hard-wiring a single analytics provider into your app,
- you don’t care about SSR, consent, or queue semantics,
- and you’re fine rewriting tracking code any time you switch tools.

Trackkit exists for the cases where those assumptions are wrong.

### 1. Unified tracking across providers

Trackkit gives you a single, provider-agnostic API (`track`, `pageview`, `identify`) that can target Umami, Plausible, GA4, or a no-op provider without changing your app code.

- Want to move from GA4 → Umami? Update config, not every call site.
- Want to mirror critical events to a second provider for a while? Spin up a second instance and keep the same event names and props.

Your application talks to *Trackkit*, not to whatever vendor you happen to be using this year.

### 2. First-class consent and queueing

Most analytics snippets treat consent as “gate the `<script>` tag and hope for the best”. Trackkit bakes consent and queueing into the core:

- **pending / granted / denied** states are explicit and configurable,
- **essential vs analytics** categories let you keep uptime/health pings without violating tracking policies,
- events can be **queued safely while consent is pending**, then flushed or dropped based on user choice.

You get predictable behaviour instead of ad-hoc `if (consent)` checks scattered across the codebase.

### 3. SSR and hydration that actually behave

Server-side rendering is where most tracking scripts quietly break down. Trackkit’s SSR story is explicit:

- a dedicated `trackkit/ssr` entry point for server-side events,
- a well-defined **SSR queue** that hydrates once into the client,
- no hidden “magic globals” that leak across requests.

That means you can track pageviews and critical events during SSR without corrupting the client queue or double-counting.

### 4. Resilience in hostile environments

Real users run:

- adblockers,
- privacy-enhancing extensions,
- corporate proxies and funky CSP rules.

Trackkit’s dispatcher is built around:

- **transport detection** (`fetch`/`beacon`/proxy) with fallbacks,
- **retry and backoff**,
- optional **proxy mode** to hide analytics vendors behind your domain.

The goal isn’t “fire-and-forget HTTP POSTs”, it’s *“deliver events as reliably and honestly as the browser and your policy allow”*.

### 5. A library, not a SaaS

Trackkit is a **client library only**:

- it doesn’t phone home to a central Trackkit server,
- it doesn’t introduce a new backend,
- it doesn’t compete with your analytics provider.

You keep using Umami/Plausible/GA4 (or something custom). Trackkit just makes your integration cleaner, safer, and easier to move.

### 6. TypeScript-native, but not type-obsessed

Trackkit is written in TypeScript and designed to be:

- usable from plain JS without ceremony, and
- **type-safe when you want it** (typed events, strong config types, `DiagnosticsSnapshot`, etc.).

You can start with the basic factory:

```ts
const analytics = createAnalytics({ provider: 'umami', site: 'my-site' });
analytics.track('signup_completed', { plan: 'pro' });
```

…and gradually adopt typed events and stricter config as your project matures.

If you want analytics without polluting your bundle or compromising user privacy, Trackkit is for you.

## FAQ

Have more questions?

See the full [Trackkit FAQ](../overview/faq.md) for answers about providers, consent, SSR, adblockers, and more.

---

Next steps:

- Get hands-on with the [Quickstart](/overview/quickstart).
- See how to configure providers in [Configuration](/reference/configuration).
- Browse [Examples](/examples/overview) for real app setups.
