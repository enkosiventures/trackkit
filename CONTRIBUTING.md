# Contributing to Trackkit

Thanks for your interest in contributing to Trackkit.  
This document explains how the repo is structured, how to run the checks, and what’s expected for changes.

Trackkit is a TypeScript monorepo (pnpm workspaces) that ships a single public package: `trackkit`.  
The code lives under `packages/trackkit`, with a small set of scripts in `/scripts` to keep things reproducible.

---

## Repo layout

Relevant bits:

```txt
trackkit/
├── packages/
│   └── trackkit/
│       ├── src/
│       │   ├── config/            # schema + runtime config resolution
│       │   ├── consent/           # ConsentManager and types
│       │   ├── connection/        # ConnectionMonitor + OfflineStore
│       │   ├── dispatcher/        # NetworkDispatcher, transports, retry
│       │   ├── facade/            # public facade, navigation, policy gate, diagnostics
│       │   ├── performance/       # performance tracker
│       │   ├── providers/         # umami/plausible/ga4/noop + provider registry
│       │   ├── queues/            # runtime + SSR queues and service
│       │   ├── util/              # env, logger, state helpers
│       │   ├── factory.ts         # createAnalytics() entry
│       │   ├── index.ts           # main browser entry (instance + singleton)
│       │   ├── ssr.ts             # SSR entry (trackkit/ssr)
│       │   ├── errors.ts          # Error types + codes
│       │   └── types.ts           # public-facing types
│       ├── README.md
│       └── vitest.config.ts
├── scripts/                        # bundle analysis, deadcode, config-doc generation
├── docs/                           # VitePress site (not shown here)
├── package.json                    # workspace root
└── pnpm-workspace.yaml
````

The docs live in `/docs` (VitePress). They’re the source of truth for behaviour.

---

## Prerequisites

* Node 18+ (LTS recommended)
* pnpm 8+
* A GitHub account if you’re opening PRs

Install dependencies:

```bash
pnpm install
```

---

## Common tasks

From the repo root:

```bash
# Run tests for all packages
pnpm test

# Type-check
pnpm typecheck

# Lint
pnpm lint

# Build packages
pnpm build

# Dead code / unused exports check
pnpm deadcode
```

Some of these commands run `pnpm -r` under the hood; if in doubt, inspect `package.json` scripts.

Before opening a PR, you should be able to run at least:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

without errors.

---

## Making changes

### 1. Fork & branch

* Fork the repo on GitHub.
* Create a feature branch off `main`:

```bash
git checkout -b feature/my-change
```

### 2. Keep changes scoped

Trackkit’s behaviour is deliberately well-defined (consent, queueing, SSR, provider semantics, event gating). Try to keep PRs focused:

* **One PR = one logical change.**
* If you’re changing behaviour, update docs + tests in the same PR.

---

## Code style & expectations

* TypeScript, strict types where possible.
* Prefer small, pure functions over ad-hoc conditionals.
* Follow the existing patterns in each directory:

  * `facade/` owns high-level orchestration.
  * `providers/` are thin adapters into HTTP transports. 
  * `dispatcher/` owns retries, batching, transports (fetch/beacon/proxy).
  * `queues/` are the only place that manipulate queue internals.
* Don’t introduce new global state; favour explicit injection and instances over singletons.

If you’re unsure where a change should live, look at the existing Umami/Plausible/GA4 implementations and match their structure.

---

## Tests

Tests live alongside code (and/or under dedicated `__tests__` dirs depending on current layout).

When you change:

* consent, queueing, SSR, or providers
* public API surface
* or diagnostics output

…you should add or update tests that:

* exercise the new behaviour,
* assert on the relevant diagnostics snapshot and/or queue state.

Run:

```bash
pnpm test
```

before pushing.

---

## Docs

The docs are not optional; they’re part of the contract.

If you:

* change behaviour,
* add a config option,
* add or change a provider,
* touch SSR semantics,

you must update:

* The relevant guide(s) under `docs/guides/…`
* The reference pages (e.g. configuration, error codes, providers) if applicable
* The FAQ if the change raises new user questions

The docs site is powered by VitePress. You can preview it locally (from the repo root):

```bash
pnpm docs:dev
```

(Adjust the script name if your `package.json` uses a different alias.)

---

## Providers & adapters

If you’re:

* adding a new provider,
* altering an existing provider’s wire format,
* changing provider capabilities,

read the **Custom Providers & Adapters** doc first. 

Key rules:

* Providers must conform to the facade contract: `pageview`, `track`, `identify`, `destroy`, optional `getSnapshot`.
* No provider is allowed to load remote scripts by default.
* GA4 integration stays Measurement-Protocol–only. 

Update:

* `/docs/providers/*.md`
* `/docs/guides/csp.md` if CSP requirements change
* `/docs/migration/from-*.md` if migration semantics change

---

## Opening a PR

* Make sure tests, lint, typecheck, and build succeed.
* Write a concise PR description:

  * What changed
  * Why
  * Any breaking changes or behaviour changes
* Link to any relevant docs pages you updated.

If your change touches public behaviour, expect review comments around:

* consistency with the canonical event gating model,
* consent/queue/SSR interplay,
* provider semantics.

---

## Reporting bugs

If you’ve hit a bug:

* Include a minimal reproduction (code snippet or repo).
* Include your environment (framework, bundler, Node version, browser).
* Include your Trackkit config (redact IDs/secrets).
* If it’s transport/policy related, include relevant logs and diagnostics (`getDiagnostics()` output where possible).

---

## Feature requests

Feature requests are welcome, but they should fit the existing design:

* event facade stays small,
* providers remain thin adapters,
* no hidden global state,
* consent + queue + SSR semantics remain predictable.

If your idea conflicts with those principles, open an issue to discuss it first before sending a large PR.
