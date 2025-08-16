# Migrating from Plausible Analytics to Trackkit

This guide helps you migrate from the Plausible script to Trackkit’s Plausible provider.

## Before: Plausible Script

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
<script>
  // Custom events
  window.plausible = window.plausible || function(){ (window.plausible.q = window.plausible.q || []).push(arguments) };

  // Example goal
  plausible('Signup', { props: { plan: 'Pro' } });
</script>
```

## After: Trackkit

### Installation

```bash
npm install trackkit
```

### Environment Configuration

```bash
# .env
VITE_TRACKKIT_PROVIDER=plausible
VITE_TRACKKIT_SITE=yourdomain.com
# Optional self-hosted endpoint
# VITE_TRACKKIT_HOST=https://analytics.yourdomain.com
```

### Code Changes

```ts
import { init, track } from 'trackkit';

// Initialize once (usually app entry)
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  // host: 'https://analytics.yourdomain.com',
  autoTrack: true, // SPA pageviews handled for you
});

// Custom events – same mental model as Plausible goals
track('Signup', { plan: 'Pro' });
```

## Key Differences

### 1) No External Scripts

Trackkit bundles the adapter. Benefits:

* ✅ Better performance (no render-blocking script)
* ✅ CSP-friendly (no remote script allowlist)
* ✅ Fewer ad-blocker false positives (especially if self-hosted)

### 2) Consent Management Built In

```ts
import { init, setConsent } from 'trackkit';

// Start pending or denied if preferred
init({ consent: { initial: 'pending' } });

// On user action:
setConsent('granted'); // Queued events flush automatically
```

### 3) TypeScript Support & Safe Props

```ts
track('Signup', {
  plan: 'Pro',     // string ok
  seats: 10,       // converted to "10" for Plausible
  annual: true,    // converted to "true"
});
```

### 4) SPA-Friendly by Default

* History API navigation
* Optional `includeHash` for hash-routing
* Debounced referrer handling

No manual pageview calls needed unless you turn `autoTrack` off.

### 5) Error Handling

```ts
init({
  onError: (err) => {
    console.error('Analytics error', err);
    // pipe to your error tracker
  }
});
```

## Advanced Migration

### Self-Hosted / Custom Domain

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  host: 'https://analytics.yourdomain.com',
});
```

### Hash-Based Routing

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  includeHash: true,
});
```

### Revenue Goals

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  revenue: {
    currency: 'USD',
    trackingEnabled: true,
  },
});

// Later:
track('Purchase', { revenue: 49.99, currency: 'USD' });
```

### Exclusions

```ts
init({
  provider: 'plausible',
  site: 'yourdomain.com',
  exclude: ['/admin/*', '/_next/*', '*/preview'],
});
```

## Testing Your Migration

1. **Run with both temporarily**

   ```html
   <!-- Keep Plausible script -->
   <script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
   <!-- Add Trackkit in parallel -->
   <script type="module">
     import { init, track } from '/node_modules/trackkit/dist/index.js';
     init({ provider: 'plausible', site: 'yourdomain.com' });
     track('MigrationTest');
   </script>
   ```

2. **Verify events**

   * Check Plausible dashboard
   * Compare Trackkit logs with `debug: true`

3. **Remove Plausible script**
   Once confidence is high, delete the `<script>` tag.

## Common Issues

### Events Missing

* Confirm `site` matches the Plausible domain
* Set `trackLocalhost: true` in development
* Check consent: `setConsent('granted')`
* Inspect console with `debug: true`

### Property Types

* Non-string props are stringified for Plausible; complex objects are ignored.

### CSP

```
connect-src 'self' https://plausible.io https://analytics.yourdomain.com;
```

(No `script-src` needed for Plausible if you use Trackkit.)

## Rollback Plan

Keep a switch during rollout:

```ts
const useTrackkit = location.search.includes('use-trackkit');

if (useTrackkit) {
  import('trackkit').then(({ init }) => init({ provider: 'plausible', site: 'yourdomain.com' }));
} else {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://plausible.io/js/script.js';
  s.setAttribute('data-domain', 'yourdomain.com');
  document.head.appendChild(s);
}
```
