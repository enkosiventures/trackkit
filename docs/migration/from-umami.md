# Migrating from Vanilla Umami to Trackkit

This guide helps you migrate from the standard Umami script tag to Trackkit's Umami provider.

## Before: Script Tag

```html
<!-- Traditional Umami -->
<script async defer 
  src="https://analytics.example.com/script.js" 
  data-website-id="94db1cb1-74f4-4a40-ad6c-962362670409"
  data-domains="example.com,www.example.com"
  data-auto-track="true">
</script>

<script>
  // Custom events with global umami object
  document.getElementById('buy-button').addEventListener('click', () => {
    umami.track('purchase-button');
  });
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
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=94db1cb1-74f4-4a40-ad6c-962362670409
VITE_TRACKKIT_HOST=https://analytics.example.com
```

### Code Changes

```typescript
import { init, track } from 'trackkit';

// Initialize (usually in your app entry point)
const analytics = init({
  domains: ['example.com', 'www.example.com'],
  autoTrack: true, // Automatic pageview tracking
});

// Custom events - same API
document.getElementById('buy-button').addEventListener('click', () => {
  track('purchase-button');
});
```

## Key Differences

### 1. No External Scripts

Trackkit bundles the Umami logic, eliminating:
- External script requests
- CORS issues  
- Ad blocker interference
- CSP complications

### 2. Consent Management

```typescript
// Built-in consent handling
import { setConsent } from 'trackkit';

// No events sent until consent granted
setConsent('denied'); // Initial state

// Your consent banner logic
onUserConsent(() => {
  setConsent('granted'); // Events start flowing
});
```

### 3. TypeScript Support

```typescript
import { track } from 'trackkit';

// Full type safety
track('purchase', {
  product_id: 'SKU-123',
  price: 29.99,
  currency: 'USD'
});
```

### 4. SPA-Friendly

Trackkit automatically handles:
- History API navigation
- Hash changes
- Dynamic page titles
- Proper referrer tracking

No manual `umami.track()` calls needed for navigation.

### 5. Error Handling

```typescript
init({
  onError: (error) => {
    console.error('Analytics error:', error);
    // Send to error tracking service
  }
});
```

## Advanced Migration

### Custom Domains

```typescript
// Exact match
domains: ['app.example.com']

// Wildcard subdomains  
domains: ['*.example.com']

// Multiple domains
domains: ['example.com', 'example.org']
```

### Disable Auto-Tracking

```typescript
init({
  autoTrack: false // Manual pageview control
});

// Track manually
import { pageview } from 'trackkit';
router.afterEach((to) => {
  pageview(to.path);
});
```

### Server-Side Rendering

```typescript
// server.js
import { track, serializeSSRQueue } from 'trackkit/ssr';

// Track server-side events
track('server_render', { path: req.path });

// In HTML template
const html = `
  <head>
    ${serializeSSRQueue()}
  </head>
`;
```

## Testing Your Migration

1. **Check Network Tab**: Verify events sent to your Umami instance
2. **Console Logs**: Enable `debug: true` to see all events
3. **Umami Dashboard**: Confirm events appear correctly

## Rollback Plan

If you need to temporarily rollback:

```typescript
// Keep both during transition
if (window.location.search.includes('use-trackkit')) {
  // Trackkit version
  import('trackkit').then(({ init }) => init());
} else {
  // Legacy Umami script
  const script = document.createElement('script');
  script.src = 'https://analytics.example.com/script.js';
  script.setAttribute('data-website-id', 'your-id');
  document.head.appendChild(script);
}
```

## Common Issues

### Events Not Sending

1. Check consent state: `setConsent('granted')`
2. Verify domain whitelist includes current domain
3. Ensure Do Not Track is handled as expected
4. Check browser console for errors with `debug: true`

### Different Event Counts

Trackkit may show more accurate counts due to:
- Better SPA navigation tracking
- Proper handling of quick navigation
- Consent-aware event queueing

### CSP Errors

Update your Content Security Policy:

```
connect-src 'self' https://analytics.example.com;
```

No `script-src` needed since Trackkit is bundled!
```

### 3.2 Provider Comparison (`docs/providers/umami.md`)

```markdown
# Umami Provider

The Umami provider integrates with Umami Analytics, a privacy-focused, open-source analytics solution.

## Features

- ✅ No cookies required
- ✅ GDPR compliant by default
- ✅ Automatic pageview tracking
- ✅ Custom event support
- ✅ Do Not Track support
- ✅ Domain whitelisting

## Configuration

### Basic Setup

```typescript
import { init } from 'trackkit';

init({
  provider: 'umami',
  site: 'your-website-id',
  host: 'https://your-umami-instance.com', // Optional
});
```

### All Options

```typescript
init({
  provider: 'umami',
  site: 'your-website-id',
  host: 'https://cloud.umami.is', // Default
  autoTrack: true,    // Auto-track pageviews
  doNotTrack: true,   // Respect DNT header
  domains: ['example.com'], // Domain whitelist
  cache: false,       // Cache busting
});
```

## API Usage

### Track Custom Events

```typescript
import { track } from 'trackkit';

// Simple event
track('newsletter_signup');

// Event with properties
track('purchase', {
  product: 'T-Shirt',
  price: 29.99,
  currency: 'USD',
});

// Event with custom URL
track('download', { file: 'guide.pdf' }, '/downloads');
```

### Manual Pageviews

```typescript
import { pageview } from 'trackkit';

// Track current page
pageview();

// Track specific URL
pageview('/virtual/thank-you');
```

## Limitations

- **No User Identification**: Umami doesn't support user tracking
- **No Session Tracking**: Each event is independent
- **Limited Properties**: Event data must be simple key-value pairs

## Self-Hosting

To avoid ad blockers and improve privacy:

1. Host Umami on your domain
2. Configure Trackkit:

```typescript
init({
  provider: 'umami',
  site: 'your-site-id',
  host: 'https://analytics.yourdomain.com',
});
```

3. Update CSP if needed:

```
connect-src 'self' https://analytics.yourdomain.com;
```

## Debugging

Enable debug mode to see all events:

```typescript
init({
  provider: 'umami',
  site: 'your-site-id',
  debug: true,
});
```

Check browser console for:
- Event payloads
- Network requests
- Error messages

## Best Practices

1. **Use Environment Variables**
   ```bash
   VITE_TRACKKIT_PROVIDER=umami
   VITE_TRACKKIT_SITE=your-id
   VITE_TRACKKIT_HOST=https://analytics.example.com
   ```

2. **Implement Consent Flow**
   ```typescript
   // Start with consent denied
   setConsent('denied');
   
   // After user accepts
   setConsent('granted');
   ```

3. **Track Meaningful Events**
   ```typescript
   // Good: Specific, actionable
   track('checkout_completed', { value: 99.99 });
   
   // Avoid: Too generic
   track('click');
   ```

4. **Handle Errors**
   ```typescript
   init({
     onError: (error) => {
       if (error.code === 'NETWORK_ERROR') {
         // Umami server might be down
       }
     }
   });
   ```