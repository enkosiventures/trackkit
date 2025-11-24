# FAQ

Common questions about how Trackkit works, when to use it, and what it does *not* do.


## Is Trackkit a replacement for GA4, Umami, Plausible, etc.?

No.

Trackkit is a **client-side library** that sits in front of existing analytics tools. It:

- normalises your tracking API (`track`, `pageview`, `identify`),
- manages consent, queueing, SSR hydration and resilience,
- forwards events to providers like Umami, Plausible, GA4, or your own adapter.

You still need a backend analytics system to receive and store events.


## Why not just pick one provider and call its API directly?

You absolutely can. Direct integration is fine when:

- you’re confident you’ll never change tools,
- you don’t need a shared abstraction across multiple properties/apps,
- and you’re happy to hand-roll consent / queue / SSR logic.

The value of Trackkit shows up when:

- you want **one tracking implementation** that can target different providers,
- you’d like a **single place** to handle consent, DNT, queue overflow, and SSR,
- you want the option to **mirror events** to a second provider for a while,
- or you’re running multiple apps and don’t want each to reinvent the same plumbing.

If you’re hard-wired to a single provider forever, Trackkit might be overkill. If you want flexibility and consistency, it’s the point.


## Does Trackkit guarantee event delivery?

No analytics tool can guarantee delivery in all network environments.
Trackkit’s resilience features (queueing, offline store, proxy transport, beacon API) improve reliability, but events may still be dropped if:

- policy blocks them (DNT, domain filters),
- consent prohibits sending,
- storage limits overflow,
- the browser rejects transmission (e.g., strict cross-site blocking).


## Can Trackkit send events through my own domain?

Yes.

Trackkit supports [first-party proxying](/guides/resilience-and-transports#proxy-transport) via the **transport** layer.

This improves CSP compatibility, avoids adblocker heuristics, and allows consistent analytics hostname usage.


## Does Trackkit send any data to its own servers?

No.

Trackkit:

- runs entirely in your app,
- forwards events only to the providers you configure,
- does **not** introduce a new backend or “call home” endpoint.

All network traffic goes to your chosen analytics hosts (Umami, Plausible, GA, or a proxy you control).


## Does Trackkit load any remote scripts?

No.

Trackkit does not load any remote analytics scripts (`gtag.js`, Plausible script, Umami tracker, etc.). It sends events via **direct HTTP requests** (or your proxy).

If you want to load a provider’s script—for Tag Manager, heatmaps, advanced GA features—you must do that manually. Trackkit won’t load it for you.


## Is Trackkit safe to use for GDPR / CCPA?

Trackkit is designed to make compliance *easier*, but it doesn’t magically make you compliant.

What it does provide:

- a **consent model** (`pending` / `granted` / `denied`) with configurable defaults,
- a distinction between **essential** and **analytics** event categories,
- options to **block queueing completely** when consent is denied,
- configuration to respect or ignore browser **Do Not Track**.

You are still responsible for:

- defining what counts as “essential” in your context,
- wiring your CMP (consent banner) to Trackkit’s consent API,
- configuring providers and proxies according to your legal obligations.

Trackkit gives you explicit hooks; it does not substitute for a legal review.


## How does Trackkit handle consent in practice?

At a high level:

- Trackkit keeps an internal consent state: `pending`, `granted`, or `denied`.
- You can configure default behaviour via `InitOptions.consent` (initialStatus, requireExplicit, allowEssentialOnDenied, etc.).
- Events are tagged with a **category** (`analytics` by default, or `essential` when you explicitly opt in).
- The queue and policy gate use those categories and status to decide whether to queue, flush, or drop events.

You typically:

1. Initialise Trackkit with `initialStatus: 'pending'`.
2. Show a consent banner / CMP.
3. On user action, call `grantConsent()` or `denyConsent()`.
4. Trackkit then either:
   - flushes pending analytics events, or
   - drops them and only lets essential events through.

All consent decisions feed into the gating pipeline:

**PolicyGate → Consent → Provider Readiness → Queue/Offline → Transport**

See the **[Consent & Privacy](/guides/consent-and-privacy)** guide for configuration details.


## What’s the difference between “essential” and “analytics” events?

- **Essential** events are things you consider required for the app to function:
  - uptime pings,
  - critical error reporting,
  - security or abuse detection,
  - strictly necessary operational metrics.

- **Analytics** events are everything else:
  - funnels, product metrics, A/B test events, marketing attribution, etc.

Trackkit doesn’t enforce your policy for you, but it:

- lets you tag events with a category,
- treats categories differently when consent is `denied`,
- and exposes configuration options to control how strict that separation is.

Trackkit internally only marks identify and minimal provider-setup signals as essential. All other events are analytics by default.

## Does Trackkit batch events?

Yes.

You can configure batch size and batch timeout per provider.

Batching is applied after consent and policy rules allow sending, and before transport selection.


## How does the queue behave on overflow?

Trackkit uses a bounded in-memory queue per instance.

Key points:

- The queue has a fixed `maxSize` (configurable).
- On overflow, **the oldest events are dropped first**, preserving the most recent ones.
- Dropped events are surfaced via the `QUEUE_OVERFLOW` error code and an optional overflow handler.

This is intentional: in practice, “what just happened” is more valuable than “every event from three minutes ago”.

See the **[Queue Management](/guides/queue-management)** guide for details.


## Does Trackkit work with SSR frameworks like Next.js?

Yes.

There is a dedicated `trackkit/ssr` module for server-side usage. It:

- records events into an **SSR queue** during render,
- lets you **serialize** that queue into HTML,
- and hydrates it **once** into the client runtime queue.

The key semantic points:

- SSR functions (`track`, `pageview`, `identify` from `trackkit/ssr`) **do not** initialise providers on the server.
- The SSR queue is global per page render (e.g. exposed as `window.__TRACKKIT_SSR_QUEUE__`).
- On the client, the facade hydrates that queue once and then treats it as drained.

Hydrated SSR events preserve their category (essential/analytics) and must pass through the same consent and policy gates as runtime events.

The [Next.js example](/examples/next-ssr-ga4) demonstrates a complete setup.


## Should I use the factory API or the singleton API?

Prefer the **factory API**:

```ts
const analytics = createAnalytics({ provider: 'umami', site: 'my-site' });
analytics.track('signup_completed', { plan: 'pro' });
```

Use the singleton when:

* you have a very simple app,
* or you are migrating legacy code that already assumes global tracking functions.

The singleton API is kept for convenience, but the factory approach is easier to reason about, test, and type.


## Does Trackkit provide a React/Vue wrapper?

Not yet.

Right now, you use Trackkit directly from your app code:

* create an instance in your app entry point,
* pass it around or put it in context,
* call `track` / `pageview` / `identify` where needed.

A React/Vue wrapper (hooks, providers, etc.) is a likely future addition, but not required to use Trackkit today.

Using the factory API and React/Vue context is currently the recommended pattern.


## How heavy is the Trackkit bundle?

Trackkit is designed to be lightweight:

* tree-shakable ES modules,
* no runtime dependencies on React/Vue/other frameworks,
* providers and transports are split so you only pay for what you import.

Exact size depends on your build and which providers you include. The bundle analysis script in the repo (`scripts/analyze-bundle.mjs`) can give you a precise number for your configuration.


## How stable is the API? Is this production ready?

The library is tagged as **beta** until:

* the core semantics (consent, queueing, SSR, providers) have seen enough real-world use,
* the API surface has stopped changing in breaking ways,
* and the docs accurately reflect behaviour.

During beta:

* breaking changes may occur between minor versions,
* but changes are documented in the changelog and migration notes.

Once it reaches `1.0.0`, semantic versioning applies: breaking changes will only land in major versions.


## Can Trackkit help with adblockers and strict CSP?

Yes, to a point.

Trackkit does not detect adblockers directly, but it does detect blocked requests and falls back to more resilient transports (e.g. beacon or proxy).

Trackkit doesn’t bypass user choice, but it does include:

* support for a **first-party proxy** so your analytics calls hit your own domain,
* guidelines for **CSP rules** for each provider.

If a user or network environment aggressively blocks analytics, Trackkit will respect that and surface the failure in diagnostics rather than silently failing in undefined ways.

The GA4 integration uses the Measurement Protocol only, so no GA scripts require CSP permissions unless you choose to load gtag.js yourself.


## Why do I still see GA4 cookies even if Trackkit uses MP-only?

Trackkit never loads `gtag.js` and never sets GA cookies.

However, GA4’s server infrastructure may still set cookies depending on your property’s configuration (e.g., first-party measurement, enhanced attribution).

These cookies are set server-side by Google, not by Trackkit.
