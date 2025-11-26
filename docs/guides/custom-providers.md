# Custom Providers & Adapters

Trackkit ships with adapters for **Umami**, **Plausible**, **GA4**, and a `noop` provider for local development.

Internally, each provider is implemented as a small adapter that plugs into the same queue, dispatcher and diagnostics pipeline. This guide shows how to add **additional providers** by implementing a custom adapter inside Trackkit.

> This guide is intended for advanced users or contributors who are comfortable editing `packages/trackkit/src/providers/**` and shipping a custom build.

> There is no runtime plugin registry yet – providers are currently wired at build time.


## Overview

At a high level:

```txt
Your app
  → Trackkit facade (createAnalytics/init)
    → ProviderManager
      → Provider adapter (your code)
        → NetworkDispatcher
          → HTTP transport (fetch / beacon / proxy)
```

A provider adapter is responsible for:

* Translating **Trackkit events** (`pageview`, `track`, `identify`) into **HTTP payloads** that the vendor understands.
* Managing any vendor-specific state (e.g. measurement ID, script bootstrap, cookies).
* Exposing an optional `getSnapshot()` method for diagnostics.

Trackkit handles:

* Queueing, SSR hydration, consent gating.
* Batching, retry/backoff, adblocker detection and transport selection.
* Diagnostics plumbing (provider state history, queue stats, URLs).


## Anatomy of a provider

All providers live under:

```txt
packages/trackkit/src/providers/
  base/
    adapter.ts
    transport.ts
  umami/
  plausible/
  ga4/
  noop/
  ...
```

A provider module usually has:

* `types.ts` – options specific to this provider.
* `client.ts` or `spec.ts` – the adapter implementation.
* `index.ts` – small wrapper that exports a `ProviderFactory`.

### Provider factory

The GA4 adapter is a good minimal example:

```ts
// packages/trackkit/src/providers/ga4/index.ts
import type { ProviderType } from '../../types';
import { createGA4Client } from './client';
export type { GA4Options } from './types';

export default {
  create: createGA4Client,
  meta: {
    name: 'ga4' as ProviderType,
    version: '1.0.0',
  }
};
```

The important bits:

* `create` – a function that receives normalized provider options and returns a provider instance.
* `meta` – metadata used by the registry / diagnostics (e.g. provider name, version, defaults).

> Tip: use `ProviderFactory` or related types from `packages/trackkit/src/providers/types.ts` to get full type safety when adding a new provider.


## Step 1 – Define provider options

Create a new directory, e.g.:

```txt
packages/trackkit/src/providers/myprovider/
  index.ts
  types.ts
  client.ts (or spec.ts)
```

In `types.ts`:

```ts
// packages/trackkit/src/providers/myprovider/types.ts
export interface MyProviderOptions {
  apiKey: string;
  endpoint?: string;
}
```

These options will later be merged into the main `InitOptions` via `providerOptions` or a dedicated `myProvider` block (depending on how you design it). Keep them minimal and explicit.


## Step 2 – Implement the adapter

Most providers follow the same pattern:

* Keep a reference to a **NetworkDispatcher**.
* Map `pageview`, `track`, `identify` into vendor payloads.
* Optionally expose `getSnapshot()` for diagnostics.

A heavily simplified schematic:

```ts
// packages/trackkit/src/providers/myprovider/client.ts
import type { MyProviderOptions } from './types';
import { NetworkDispatcher } from '../dispatcher/network-dispatcher'; // adjust relative path
import type { ProviderStateHistory } from '../../util/state';

interface MyProviderState {
  ready: boolean;
  lastStatus?: number;
}

export function createMyProviderClient(opts: MyProviderOptions) {
  const state: MyProviderState = { ready: true };
  const history: ProviderStateHistory = [];

  const dispatcher = new NetworkDispatcher({
    resilience: { detectBlockers: true },
    batching: { enabled: false },
    defaultHeaders: { 'X-Api-Key': opts.apiKey },
  });

  async function send(path: string, body: unknown) {
    await dispatcher.send({
      url: opts.endpoint ?? 'https://api.example-analytics.com' + path,
      body,
    });
  }

  return {
    // called by facade via ProviderManager
    async pageview(url: string, ctx: any) {
      await send('/pageview', { url, ...ctx });
    },

    async track(name: string, props: Record<string, any>, ctx: any) {
      await send('/event', { name, props, ...ctx });
    },

    async identify(userId: string | null, traits?: Record<string, any>) {
      if (!userId) return;
      await send('/identify', { userId, traits });
    },

    // optional, but used by DiagnosticsService if present
    getSnapshot() {
      return {
        state,
        history,
        details: {
          endpoint: opts.endpoint,
        },
      };
    },

    // called when facade is destroyed
    async destroy() {
      await dispatcher.flush();
    },
  };
}
```

You don’t have to match the exact method set above – use the shape expected by the `ProviderFactory`/`ProviderManager` types. The core idea is:

* Accept normalized options.
* Provide methods for `pageview`, `track`, `identify`, `destroy`.
* Optionally provide `getSnapshot()` for diagnostics.


## Step 3 – Export a provider factory

In `index.ts`:

```ts
// packages/trackkit/src/providers/myprovider/index.ts
import type { ProviderType } from '../../types';
import type { ProviderFactory } from '../types';
import { createMyProviderClient } from './client';
export type { MyProviderOptions } from './types';

const myProvider: ProviderFactory = {
  create: createMyProviderClient,
  meta: {
    name: 'myprovider' as ProviderType,
    version: '1.0.0',
    // you may also expose provider defaults here depending on your metadata design
  },
};

export default myProvider;
```


## Step 4 – Register the provider

Open `packages/trackkit/src/providers/registry.ts`

You’ll see a map of built-in providers, something conceptually like:

```ts
const registry = {
  umami,
  plausible,
  ga4,
  noop,
};
```

Add your provider:

```ts
import myprovider from './myprovider';

const registry = {
  umami,
  plausible,
  ga4,
  noop,
  myprovider,
};
```

And ensure that the `ProviderType` union in `packages/trackkit/src/types.ts` (or wherever it lives) includes the new key `'myprovider'`.


## Step 5 – Configure from the app

Once the provider is wired into the registry and the type union:

```ts
import { createAnalytics } from 'trackkit';

const analytics = createAnalytics({
  provider: 'myprovider',
  site: '…', // if you need it
  // or preferably a dedicated options block based on your types:
  providerOptions: {
    myprovider: {
      apiKey: '…',
      endpoint: 'https://api.example-analytics.com',
    }
  }
});
```

Match this to however you’ve wired provider-specific options into your `InitOptions`; use the existing Umami / Plausible / GA4 implementations as authoritative examples.


## Diagnostics & Snapshots

If your provider implements `getSnapshot()`, it will automatically be surfaced by:

```ts
const analytics = createAnalytics({ debug: true });
const diag = analytics.getDiagnostics();

console.log(diag.provider.state, diag.provider.history, diag.provider.details);
```

Use this to expose useful internal state:

* Last known endpoint
* Last HTTP status
* Flags like `scriptLoaded`, `blockedByCSP`, etc.


## When *not* to write a custom provider

Before adding a new adapter, ask:

* Can I use a **first-party proxy** to reuse an existing provider (e.g. proxy Google Analytics or Segment to Umami/Plausible)?
* Is the provider actually compatible with the **pageview + event + identify** model, or is it fundamentally different?

If you can express your provider’s API as a small mapping on top of the existing HTTP event model, Trackkit is a good fit. If it needs deep control over DOM, arbitrary script injection, or bidirectional sessions, you’re probably better off keeping that integration separate.
