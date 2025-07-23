# Trackkit Core

> Privacy-first analytics SDK with built-in consent management and multi-provider support

[![npm version](https://img.shields.io/npm/v/trackkit.svg?style=flat-square)](https://www.npmjs.com/package/trackkit)
[![bundle size](https://img.shields.io/bundlephobia/minzip/trackkit?style=flat-square)](https://bundlephobia.com/package/trackkit)
[![license](https://img.shields.io/npm/l/trackkit.svg?style=flat-square)](https://github.com/your-org/trackkit/blob/main/LICENSE)

## Installation

```bash
npm install trackkit
# or
pnpm add trackkit
# or
yarn add trackkit
```

## Quick Start

```typescript
import { init, track, pageview } from 'trackkit';

// Initialize with your preferred provider
init({
  provider: 'umami',  // or 'plausible' | 'ga' | 'noop'
  siteId: 'your-site-id',
});

// Track page views
pageview();

// Track custom events
track('button_clicked', {
  location: 'header',
  variant: 'primary'
});
```

## Features

### 🔌 Multiple Analytics Providers

```typescript
// Umami - Privacy-focused, self-hosted
init({ provider: 'umami', siteId: 'uuid', host: 'https://analytics.you.com' });

// Plausible - Lightweight, privacy-first
init({ provider: 'plausible', siteId: 'yourdomain.com' });

// Google Analytics 4 - Feature-rich
init({ provider: 'ga', siteId: 'G-XXXXXXXXXX' });

// No-op - Development/testing
init({ provider: 'noop' });
```

### 🛡️ Privacy & Consent Management

Built-in GDPR-compliant consent management:

```typescript
import { track, grantConsent, denyConsent, getConsent } from 'trackkit';

// Check consent status
const consent = getConsent();
console.log(consent.status); // 'pending' | 'granted' | 'denied'

// Events are automatically queued when consent is pending
track('event_while_pending'); // Queued

// Grant consent - queued events are sent
grantConsent();

// Or deny consent - queue is cleared
denyConsent();

// Listen for consent changes
const unsubscribe = onConsentChange((status, prevStatus) => {
  console.log(`Consent changed from ${prevStatus} to ${status}`);
});
```

### 📦 Tree-Shaking Support

Import only what you need:

```typescript
// Minimal imports for smaller bundles
import track from 'trackkit/methods/track';
import grantConsent from 'trackkit/methods/grantConsent';

// Each method is ~2KB when imported separately
track('lightweight_event');
```

### 🎯 TypeScript Support

Full type safety with event definitions:

```typescript
import { init, TypedAnalytics } from 'trackkit';

// Define your events
type AppEvents = {
  'purchase_completed': {
    order_id: string;
    total: number;
    currency: 'USD' | 'EUR';
    items: Array<{
      sku: string;
      quantity: number;
    }>;
  };
  'search_performed': {
    query: string;
    results: number;
  };
};

// Get type-safe analytics
const analytics = init() as TypedAnalytics<AppEvents>;

// TypeScript enforces correct properties
analytics.track('purchase_completed', {
  order_id: 'ORD-123',
  total: 99.99,
  currency: 'USD',
  items: [{ sku: 'SHOE-42', quantity: 1 }]
}); // ✅ Type-safe

analytics.track('purchase_completed', {
  total: 99.99
}); // ❌ TypeScript error: missing required fields
```

### 🚀 Server-Side Rendering (SSR)

Seamless SSR support with automatic hydration:

```typescript
// server.js
import { init, track } from 'trackkit';

init({ provider: 'umami', siteId: 'xxx' });
track('server_event', { path: request.url });

// Events stored in globalThis.__TRACKKIT_SSR_QUEUE__
```

```typescript
// client.js
import { init } from 'trackkit';

// Automatically hydrates SSR queue
init({ provider: 'umami', siteId: 'xxx' });
// Server events are replayed after consent
```

## API Reference

### Initialization

#### `init(options: AnalyticsOptions): AnalyticsInstance`

Initialize analytics with your chosen provider.

```typescript
const analytics = init({
  // Required
  provider: 'umami',      // Provider selection
  siteId: 'your-site-id', // Site identifier
  
  // Optional
  host: 'https://...',    // Custom analytics host
  debug: true,            // Enable debug logging
  autoTrack: true,        // Auto-track pageviews (default: true)
  queueSize: 50,          // Max queued events (default: 50)
  
  // Consent options
  consent: {
    requireExplicit: false,   // Require explicit consent (default: varies by provider)
    policyVersion: '1.0',     // Privacy policy version
    persistDecision: true,    // Remember consent choice
    storageKey: 'consent',    // LocalStorage key
  },
  
  // Error handling
  onError: (error) => {
    console.error('Analytics error:', error);
  }
});
```

### Tracking Methods

#### `track(name: string, props?: object, url?: string): void`

Track custom events with optional properties.

```typescript
// Basic event
track('signup_started');

// With properties
track('item_added_to_cart', {
  item_id: 'SKU-123',
  name: 'Blue T-Shirt',
  price: 29.99,
  quantity: 2
});

// With custom URL
track('virtual_pageview', {}, '/checkout/step-2');
```

#### `pageview(url?: string): void`

Track page views.

```typescript
// Track current page
pageview();

// Track specific URL
pageview('/products/shoes');

// Track with query params
pageview('/search?q=analytics');
```

#### `identify(userId: string | null): void`

Set or clear user identification.

```typescript
// Identify user
identify('user_123');

// Clear identification (on logout)
identify(null);
```

### Consent Methods

#### `grantConsent(): void`

Grant analytics consent and send queued events.

```typescript
// User accepts analytics
grantConsent();
```

#### `denyConsent(): void`

Deny consent and clear event queue.

```typescript
// User rejects analytics
denyConsent();
```

#### `resetConsent(): void`

Reset consent to pending state.

```typescript
// Clear consent decision
resetConsent();
```

#### `getConsent(): ConsentSnapshot | null`

Get current consent state and statistics.

```typescript
const consent = getConsent();
// {
//   status: 'granted',
//   timestamp: 1234567890,
//   method: 'explicit',
//   policyVersion: '1.0',
//   queuedEvents: 0,
//   sentEvents: 42,
//   droppedEvents: 0
// }
```

#### `onConsentChange(callback): () => void`

Subscribe to consent state changes.

```typescript
const unsubscribe = onConsentChange((status, prevStatus) => {
  if (status === 'granted') {
    console.log('Analytics enabled');
  }
});

// Cleanup
unsubscribe();
```

### Utility Methods

#### `waitForReady(): Promise<AnalyticsInstance>`

Wait for provider initialization.

```typescript
await waitForReady();
console.log('Analytics ready!');
```

#### `getInstance(): AnalyticsInstance | null`

Get the current analytics instance.

```typescript
const instance = getInstance();
if (instance) {
  instance.track('direct_call');
}
```

#### `getDiagnostics(): object`

Get diagnostic information for debugging.

```typescript
const diagnostics = getDiagnostics();
console.log(diagnostics);
// {
//   hasProvider: true,
//   providerReady: true,
//   queueSize: 0,
//   consent: 'granted',
//   provider: 'umami',
//   debug: false
// }
```

#### `destroy(): void`

Clean up analytics instance.

```typescript
// Clean up on app unmount
destroy();
```

## Configuration

### Environment Variables

Configure Trackkit using environment variables:

```bash
# Provider selection
TRACKKIT_PROVIDER=umami

# Site identification  
TRACKKIT_SITE_ID=550e8400-e29b-41d4-a716-446655440000

# Custom host (optional)
TRACKKIT_HOST=https://analytics.yourdomain.com

# Queue size (optional)
TRACKKIT_QUEUE_SIZE=100

# Debug mode (optional)
TRACKKIT_DEBUG=true
```

Access in your app:

```typescript
// Vite
import.meta.env.VITE_TRACKKIT_PROVIDER

// Next.js
process.env.NEXT_PUBLIC_TRACKKIT_PROVIDER

// Create React App
process.env.REACT_APP_TRACKKIT_PROVIDER
```

### Provider-Specific Options

#### Umami

```typescript
init({
  provider: 'umami',
  siteId: 'uuid-from-umami-dashboard',
  host: 'https://your-umami-instance.com', // Self-hosted
  // Umami is cookieless and GDPR-compliant by default
});
```

#### Plausible

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  host: 'https://plausible.io', // Or self-hosted
  
  // Plausible-specific options
  hashMode: true,        // For hash-based routing
  trackLocalhost: false, // Track localhost visits
  exclude: ['/admin/*'], // Exclude paths
  revenue: {             // Revenue tracking
    currency: 'USD',
    trackingEnabled: true
  }
});
```

#### Google Analytics 4

```typescript
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
  
  // GA4-specific options
  apiSecret: 'secret',          // For server-side tracking
  transport: 'beacon',          // Transport method
  customDimensions: {           // Map custom dimensions
    plan_type: 'dimension1',
    user_role: 'dimension2'
  }
});
```

## Advanced Usage

### Custom Error Handling

```typescript
init({
  provider: 'umami',
  siteId: 'xxx',
  onError: (error) => {
    // Log to error tracking service
    if (error.code === 'NETWORK_ERROR') {
      console.warn('Analytics blocked or offline');
    }
    
    // Send to Sentry, etc.
    Sentry.captureException(error);
  }
});
```

### Conditional Tracking

```typescript
// Track only in production
if (process.env.NODE_ENV === 'production') {
  init({ provider: 'umami', siteId: 'xxx' });
}

// Track only for opted-in users
if (user.analyticsOptIn) {
  track('feature_used', { feature: 'search' });
}

// Track with sampling
if (Math.random() < 0.1) { // 10% sampling
  track('expensive_event');
}
```

### Queue Management

```typescript
// Get queue state
const diagnostics = getDiagnostics();
console.log(`${diagnostics.queueSize} events queued`);

// Increase queue size for offline apps
init({
  provider: 'umami',
  siteId: 'xxx',
  queueSize: 200 // Default is 50
});
```

### Multi-Instance Tracking

```typescript
// Track to multiple providers
const umami = init({ provider: 'umami', siteId: 'xxx' });
const ga = init({ provider: 'ga', siteId: 'G-XXX' });

// Send to specific provider
umami.track('event_for_umami');
ga.track('event_for_ga');
```

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- iOS Safari 13+
- Node.js 16+

All browsers supporting:
- ES2017
- Promises
- Fetch API
- LocalStorage (optional)

## Performance

### Bundle Impact

| Import | Size (gzipped) | Notes |
|--------|----------------|-------|
| Full SDK | ~6.9 KB | Everything included |
| Core only | ~4.5 KB | Without providers |
| Single method | ~2 KB | Tree-shaken import |
| Umami provider | ~1.5 KB | When lazy loaded |
| Plausible | ~2.5 KB | When lazy loaded |
| GA4 provider | ~1 KB | When lazy loaded |

### Runtime Performance

- Lazy provider loading (load only what you use)
- Efficient event batching (coming soon)
- Non-blocking async operations
- Smart queue management
- Minimal CPU overhead

## Debugging

### Debug Mode

Enable detailed logging:

```typescript
init({
  provider: 'umami',
  siteId: 'xxx',
  debug: true
});

// Or via environment variable
TRACKKIT_DEBUG=true
```

Debug mode logs:
- Provider initialization
- Event tracking calls
- Queue operations
- Consent changes
- Network requests
- Errors and warnings

### Browser DevTools

```typescript
// In debug mode, access internals
window.__TRACKKIT__ = {
  queue: EventQueue,
  config: CurrentConfig,
  provider: ProviderInstance,
  consent: ConsentManager
};

// Inspect queue
console.table(window.__TRACKKIT__.queue.getEvents());

// Check consent
console.log(window.__TRACKKIT__.consent.getStatus());
```

## Migration Guides

### From Direct Provider SDKs

```typescript
// Before: Direct Umami
window.umami.track('event', { data: 'value' });

// After: Trackkit
import { track } from 'trackkit';
track('event', { data: 'value' });
```

### From Google Analytics

```typescript
// Before: gtag
gtag('event', 'purchase', {
  transaction_id: '12345',
  value: 99.99
});

// After: Trackkit
track('purchase', {
  transaction_id: '12345',
  value: 99.99
});
```

See [detailed migration guides](../../docs/migration/) for:
- [Migrating from GA4](../../docs/migration/from-ga4.md)
- [Migrating from Plausible](../../docs/migration/from-plausible.md)
- [Migrating from Umami](../../docs/migration/from-umami.md)

## FAQ

### Why is my bundle larger than 2KB?

Tree-shaking requires proper ESM imports:

```typescript
// ❌ This imports everything
import { track } from 'trackkit';

// ✅ This imports only track method
import track from 'trackkit/methods/track';
```

### Can I use multiple providers?

Yes, but you need separate instances:

```typescript
const analytics1 = init({ provider: 'umami' });
const analytics2 = init({ provider: 'ga' });
```

### Does it work with ad blockers?

- Plausible/Umami: Often blocked
- Self-hosted: Less likely blocked
- First-party domain: Best success rate

Consider server-side tracking for critical events.

### Is it GDPR compliant?

Yes, with built-in consent management:
- No tracking before consent
- Easy consent UI integration  
- Automatic queue management
- Privacy-first providers available

## Contributing

See our [Contributing Guide](../../CONTRIBUTING.md) for development setup.

```bash
# Clone and install
git clone https://github.com/your-org/trackkit
cd trackkit
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## License

MIT © 2024 Trackkit Contributors