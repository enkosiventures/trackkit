# Configuration

Trackkit can be configured via **environment variables** (build-time) and **runtime injection**. Runtime values are useful when you cannot rebuild for each environment.

## Resolution & Precedence

When resolving a key like `PROVIDER`, Trackkit looks in this order:

1. **Runtime config** (highest priority)
   - `window.__TRACKKIT_ENV__` object, e.g. `{ PROVIDER: "umami" }`
   - `<meta name="TRACKKIT_PROVIDER" content="umami">`
2. **Build-time env**
   - `TRACKKIT_PROVIDER`
   - `VITE_TRACKKIT_PROVIDER`
   - `REACT_APP_TRACKKIT_PROVIDER`

> Tip: Keys in `window.__TRACKKIT_ENV__` should be **UPPERCASE** and match the suffix after `TRACKKIT_` (e.g. `PROVIDER`, `SITE`, `HOST`).

---

## Common Keys

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `PROVIDER` | string | Analytics provider (`umami`, `plausible`, `ga4`, `noop`) | `noop` |
| `SITE` / `WEBSITE` | string | Provider site/website id (Umami/Plausible) | — |
| `HOST` | string | Analytics host / base URL (where applicable) | provider default |
| `MEASUREMENT_ID` | string | GA4 Measurement ID (e.g. `G-XXXX`) | — |
| `QUEUE_SIZE` | number | Max in-memory queue size | `50` |
| `DEBUG` | boolean (`true`/`false`/`1`/`0`) | Verbose logging | `false` |
| `AUTO_TRACK` | boolean | Enable SPA navigation autotracking | `false` |
| `DO_NOT_TRACK` | boolean | Respect browser’s DNT (set `false` to ignore) | `true` |
| `TRACK_LOCALHOST` | boolean | Send events from `localhost` | provider default |
| `INCLUDE_HASH` | boolean | Include `#hash` in URLs | `false` |
| `DOMAINS` | string/JSON | Allowed hostnames, e.g. `"app.example.com,www.example.com"` or `["app.example.com"]` | allow all |
| `EXCLUDE` | string/JSON | URL substrings to exclude, e.g. `"/admin,/debug"` or `["/admin"]` | none |
| `BATCH_SIZE` | number | Reserved for Stage 7 batching (no effect in Stage 6) | — |
| `BATCH_TIMEOUT` | number | Reserved for Stage 7 batching (no effect in Stage 6) | — |
| `TRANSPORT` | string | Transport hint (`auto`) | `auto` |
| `DEFAULT_PROPS` | JSON | Extra properties merged into events | — |
| `CONSENT` | JSON | Initial consent policy (e.g. `{"initial":"denied","requireExplicit":true}`) | `{"initialStatus":"pending"}` |

### Build Tool Prefixes

- Vite: `VITE_TRACKKIT_*`
- Create React App: `REACT_APP_TRACKKIT_*`
- Generic/Node: `TRACKKIT_*`

> If you use Next.js and want client-side exposure, prefer runtime injection or `TRACKKIT_*` in a custom config loader. (A `NEXT_PUBLIC_` prefix is **not** read by the current env reader.)

---

## Runtime Injection

Inject config at runtime (e.g. in HTML served by your app or CDN):

```html
<script>
  window.__TRACKKIT_ENV__ = {
    PROVIDER: "umami",
    SITE: "your-site-id",
    HOST: "https://analytics.example.com",
    DEBUG: "true",
    AUTO_TRACK: "true"
  };
</script>
```

You may also use meta tags (handy for static hosting):

```html
<meta name="TRACKKIT_PROVIDER" content="plausible">
<meta name="TRACKKIT_SITE" content="site-123">
```

---

## Programmatic Init

```ts
import { init } from 'trackkit';

const analytics = init({
  provider: 'plausible',
  site: 'site-123',
  host: 'https://plausible.example.com',
  debug: true,
  autoTrack: true,
});
```

> Programmatic options always go through the same validation/path as env values.

---

## Provider-Specific Notes

### Umami

* **Required:** `site` (or `website`), optionally `host`
* Example:

  ```env
  TRACKKIT_PROVIDER=umami
  TRACKKIT_SITE=abc-123
  TRACKKIT_HOST=https://umami.example.com
  ```

### Plausible

* **Required:** `site`, optionally `host`
* Example:

  ```env
  TRACKKIT_PROVIDER=plausible
  TRACKKIT_SITE=mydomain.com
  TRACKKIT_HOST=https://plausible.example.com
  ```

### GA4

* **Required:** `measurementId`
* Example:

  ```env
  TRACKKIT_PROVIDER=ga4
  TRACKKIT_MEASUREMENT_ID=G-XXXXXXX
  ```

---

## Error Handling

Trackkit surfaces typed errors:

```ts
import { init } from 'trackkit';

init({
  onError: (error) => {
    // AnalyticsError: { code, message, provider, cause? }
    console.error('[analytics]', error.code, error.message);
    // e.g., 'INIT_FAILED', 'POLICY_BLOCKED', 'PROVIDER_ERROR', 'QUEUE_OVERFLOW'
    // Optional: send to Sentry/Datadog
  },
});
```

---

## Debug Mode

Enable detailed logs:

```ts
init({ debug: true });
// or via env
TRACKKIT_DEBUG=true
```
