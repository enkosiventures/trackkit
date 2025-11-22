# Migrating from Hard-Coded Config to Env-Based Setup

If your current analytics setup inlines credentials and host URLs in code, you can migrate to Trackkit’s environment-driven configuration to:

- Keep secrets and IDs out of source
- Simplify switching between environments
- Allow runtime injection without rebuilds


## Before: hard-coded config

Example (Umami, but applies similarly to Plausible/GA4):

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

export const analytics = createAnalytics({
  provider: 'umami',
  site: '94db1cb1-74f4-4a40-ad6c-962362670409',
  host: 'https://analytics.example.com',
  debug: false,
});
```

This couples config to your build artefact.


## After: build-time env vars

Move provider/host/site to the environment:

```sh
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=94db1cb1-74f4-4a40-ad6c-962362670409
TRACKKIT_HOST=https://analytics.example.com
TRACKKIT_DEBUG=false
```

Then simplify your code:

```ts
// analytics.ts
import { createAnalytics } from 'trackkit';

// Reads from TRACKKIT_* / VITE_TRACKKIT_* / REACT_APP_TRACKKIT_* env vars
export const analytics = createAnalytics();
```

If you need per-env overrides, set different env files or CI/CD secrets.


## Optional: runtime injection (no rebuild)

For environments where you can’t easily bake env vars at build time (e.g. some hosting platforms), you can inject config at runtime:

```html
<script>
  window.__TRACKKIT_ENV__ = {
    PROVIDER: "umami",
    SITE: "94db1cb1-74f4-4a40-ad6c-962362670409",
    HOST: "https://analytics.example.com"
  };
</script>
<script type="module" src="/src/main.ts"></script>
```

Trackkit reads `window.__TRACKKIT_ENV__` first, then falls back to build-time env.


## Migration checklist

1. Identify all hard-coded analytics config (provider, site/ID, host, debug flags).
2. Move them into env vars (`TRACKKIT_*` or framework-specific prefixes).
3. Change your `createAnalytics` call to rely on envs where appropriate.
4. Optionally add `window.__TRACKKIT_ENV__` for runtime-only overrides.
5. Verify:

   * Values are correct in each environment.
   * No secrets remain in the repo or static JS bundles.
