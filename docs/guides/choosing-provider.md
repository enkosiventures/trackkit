# Choosing an Analytics Provider

Trackkit supports multiple analytics providers. Here's how to choose the right one for your needs.

## Provider Comparison

| Feature | Umami | Plausible | Google Analytics 4 |
|---------|-------|-----------|-------------------|
| **Privacy** | ✅ GDPR compliant | ✅ GDPR compliant | ⚠️ Requires consent |
| **Cookies** | ❌ Cookieless | ❌ Cookieless | ✅ Uses cookies |
| **Open Source** | ✅ Yes | ✅ Yes | ❌ No |
| **Self-Hosting** | ✅ Yes | ✅ Yes | ❌ No |
| **Cost** | Free (self-hosted) | $9+/month | Free with limits |
| **User Tracking** | ❌ No | ❌ No | ✅ Yes |
| **Custom Events** | ✅ Yes | ✅ Yes (Goals) | ✅ Yes |
| **Revenue Tracking** | ❌ No | ✅ Yes | ✅ Yes |
| **Real-time Data** | ✅ Yes | ⚠️ 5min delay | ✅ Yes |
| **Data Retention** | Unlimited | Unlimited | 14 months |
| **Bundle Size** | ~1.5 KB | ~2.5 KB | ~1 KB |

## Decision Tree

```
Need user-level tracking?
├─ Yes → Google Analytics 4
└─ No → Privacy important?
    ├─ Critical → Self-hosting required?
    │   ├─ Yes → Umami
    │   └─ No → Plausible
    └─ Not Critical → Need advanced features?
        ├─ Yes → Google Analytics 4
        └─ No → Plausible (simplest)
```

## Provider Details

### Umami

**Best for:** Privacy-conscious sites that want full data control

**Pros:**
- Complete data ownership
- No personal data collection
- Simple, clean interface
- Lightweight tracker
- Real-time analytics

**Cons:**
- Requires self-hosting
- Limited advanced features
- No user journey tracking
- No built-in goals/conversions

**Configuration:**
```typescript
init({
  provider: 'umami',
  siteId: 'your-website-id',
  host: 'https://analytics.yourdomain.com',
});
```

### Plausible

**Best for:** Privacy-focused sites wanting managed hosting

**Pros:**
- GDPR compliant by default
- Simple setup
- Goal tracking
- Revenue tracking
- Clean, focused UI
- Managed hosting available

**Cons:**
- Paid service ($9+/month)
- 5-minute data delay
- No user tracking
- Limited segmentation

**Configuration:**
```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  host: 'https://plausible.io', // Or self-hosted
  revenue: {
    currency: 'USD',
    trackingEnabled: true,
  },
});
```

### Google Analytics 4

**Best for:** Sites needing advanced analytics and user tracking

**Pros:**
- Free tier generous
- Advanced segmentation
- User journey tracking
- Integration with Google Ads
- Machine learning insights
- Audience building

**Cons:**
- Privacy concerns
- Complex interface
- Requires consent in EU
- Learning curve
- Data sampling on free tier

**Configuration:**
```typescript
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
  // Optional: for server-side tracking
  apiSecret: 'your-api-secret',
});
```

## Multi-Provider Setup

You can use multiple providers simultaneously:

```typescript
// Primary: Privacy-friendly for all users
init({
  provider: 'plausible',
  siteId: 'example.com',
});

// Secondary: GA4 for users who consent to marketing
if (userConsentsToMarketing) {
  const ga = init({
    provider: 'ga',
    siteId: 'G-XXXXXXXXXX',
  });
  ga.identify(userId);
}
```

## Migration Considerations

### From Universal Analytics to GA4
- Different data model (events vs pageviews)
- New measurement IDs (G- prefix)
- Some metrics calculated differently
- Historical data won't transfer

### From GA4 to Privacy-Friendly
- Expect lower user counts (no cross-site tracking)
- Simpler but less detailed reports
- No user-level data
- Faster, lighter website

### Testing Multiple Providers
```typescript
// A/B test providers
const provider = Math.random() > 0.5 ? 'plausible' : 'umami';
init({ provider, siteId: 'your-site' });
```

## Recommendations by Use Case

### E-commerce Sites
**Recommended:** Google Analytics 4
- Revenue tracking
- Enhanced e-commerce
- User journey analysis
- Integration with Google Ads

### Blogs & Content Sites
**Recommended:** Plausible
- Simple metrics
- Fast loading
- Privacy-friendly
- Affordable

### SaaS Applications
**Recommended:** Umami (self-hosted)
- Data privacy
- Custom events
- No data limits
- Full control

### Landing Pages
**Recommended:** Plausible
- Quick setup
- Essential metrics only
- Good for conversions
- Lightweight

## Performance Impact

Load time impact (gzipped):
- No provider: 0 KB
- GA4: ~1 KB
- Umami: ~1.5 KB  
- Plausible: ~2.5 KB

All providers use lazy loading, so only the selected provider is downloaded.

## Privacy & Compliance

### GDPR Compliance

**Umami & Plausible:**
- No consent banner required
- No personal data collected
- No cookies used

**Google Analytics 4:**
- Requires consent in EU
- Must disclose data collection
- Implement consent mode

### CCPA Compliance

All providers can be configured for CCPA:
```typescript
if (userState === 'California' && userOptedOut) {
  // Don't initialize analytics
} else {
  init({ provider: 'your-choice' });
}
```

## Cost Analysis

### Monthly Costs by Traffic

| Monthly Pageviews | Umami | Plausible | GA4 |
|-------------------|-------|-----------|-----|
| < 10k | $5* | $9 | Free |
| 10k-100k | $5* | $19 | Free |
| 100k-1M | $5* | $39-69 | Free |
| 1M-10M | $5* | $99-169 | Free** |
| 10M+ | $5* | Custom | Free** |

\* Self-hosting costs only
\** May hit sampling limits

## Technical Requirements

### Umami Self-Hosting
- PostgreSQL or MySQL database
- Node.js server
- ~1GB RAM minimum
- SSL certificate

### Plausible Self-Hosting
- PostgreSQL database
- ClickHouse database
- 4GB+ RAM recommended
- More complex than Umami

### Google Analytics 4
- No hosting required
- Google account
- Accept Terms of Service
```

### 5.2 Migration Guides

Create `docs/migration/from-ga4.md`:

```markdown
# Migrating from Google Analytics 4 to Trackkit

## Installation

```bash
npm install trackkit
```

## Before: gtag Implementation

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
  
  // Custom events
  gtag('event', 'purchase', {
    value: 29.99,
    currency: 'USD',
    items: [{
      item_id: 'SKU-123',
      item_name: 'T-Shirt',
      price: 29.99,
      quantity: 1
    }]
  });
</script>
```

## After: Trackkit Implementation

```typescript
import { init, track } from 'trackkit';

// Initialize
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
});

// Same events, cleaner API
track('purchase', {
  value: 29.99,
  currency: 'USD',
  items: [{
    item_id: 'SKU-123',
    item_name: 'T-Shirt',
    price: 29.99,
    quantity: 1
  }]
});
```

## Key Differences

### 1. No External Scripts
- ✅ Better performance (no render blocking)
- ✅ Works with strict CSP
- ✅ No more gtag/dataLayer globals

### 2. Simplified Consent Mode

Before:
```javascript
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied'
});

// After user consent
gtag('consent', 'update', {
  'analytics_storage': 'granted',
  'ad_storage': 'granted'
});
```

After:
```typescript
import { setConsent } from 'trackkit';

// Just one method
setConsent('granted'); // or 'denied'
```

### 3. TypeScript Support

```typescript
// Full type safety
track('add_to_cart', {
  currency: 'USD', // ✅ Autocomplete
  value: 19.99,
  items: [{
    item_id: 'SKU-456',
    item_name: 'Hat',
    price: 19.99,
    quantity: 1
  }]
});
```

### 4. Automatic Error Handling

```typescript
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
  onError: (error) => {
    console.error('Analytics error:', error);
    // Send to error tracking
  }
});
```

## Event Mapping

| gtag Event | Trackkit Event |
|------------|----------------|
| `gtag('event', 'page_view')` | `pageview()` |
| `gtag('event', 'purchase', {...})` | `track('purchase', {...})` |
| `gtag('event', 'login')` | `track('login')` |
| `gtag('set', {user_id: '123'})` | `identify('123')` |

## Advanced Features

### Server-Side Tracking

```typescript
// Add API secret for Measurement Protocol
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
  apiSecret: 'your-api-secret', // From GA4 UI
});
```

### Custom Dimensions

```typescript
// Define once
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
  customDimensions: {
    'plan_type': 'dimension1',
    'user_role': 'dimension2',
  }
});

// Use anywhere
track('upgrade', {
  plan_type: 'premium', // Automatically mapped to dimension1
  user_role: 'admin',   // Automatically mapped to dimension2
});
```

### Debug Mode

```typescript
// Enable GA4 validation
init({
  provider: 'ga',
  siteId: 'G-XXXXXXXXXX',
  debug: true, // Sends to debug endpoint
});
```

## Testing Your Migration

1. **Install Trackkit alongside gtag**
```typescript
// Temporarily run both
gtag('event', 'test_event');
track('test_event');
```

2. **Compare in GA4 Realtime**
- Both events should appear
- Verify parameters match

3. **Remove gtag**
```html
<!-- Remove these -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  // ... rest of gtag code
</script>
```

## Common Issues

### Events Not Appearing

1. Check consent state: `setConsent('granted')`
2. Verify Measurement ID format: `G-XXXXXXXXXX`
3. Enable debug mode to see validation errors
4. Check browser DevTools network tab

### Missing User Properties

GA4 requires explicit user ID setting:
```typescript
identify('user-123'); // Sets user_id for all future events
```

### Different Metrics

Some metrics may differ because Trackkit:
- Doesn't use cookies (unless GA4 adds them)
- Has better bot detection
- Handles SPAs differently

## Rollback Plan

Keep gtag code commented:
```html
<!-- Trackkit backup
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
-->
```

If issues arise, uncomment and remove Trackkit temporarily.
```

Create `docs/migration/from-plausible.md`:

```markdown
# Migrating from Plausible Analytics to Trackkit

## Before: Plausible Script

```html
<script defer data-domain="yourdomain.com" 
  src="https://plausible.io/js/script.js"></script>

<script>
  // Custom events  
  window.plausible = window.plausible || function() { 
    (window.plausible.q = window.plausible.q || []).push(arguments) 
  }
  
  plausible('Signup', {props: {plan: 'premium'}});
</script>
```

## After: Trackkit

```typescript
import { init, track } from 'trackkit';

init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
});

// Same API, better DX
track('Signup', { plan: 'premium' });
```

## Configuration Options

### Self-Hosted Plausible

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  host: 'https://analytics.yourdomain.com',
});
```

### Hash-Based Routing

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  hashMode: true, // For SPAs using hash routing
});
```

### Revenue Tracking

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  revenue: {
    currency: 'EUR',
    trackingEnabled: true,
  },
});

// Track revenue
track('Purchase', {
  revenue: 99.99,
  currency: 'EUR',
});
```

### Exclude Paths

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  exclude: [
    '/admin/*',
    '/api/*',
    '*/preview',
  ],
});
```

## Feature Parity

| Plausible Feature | Trackkit Support |
|-------------------|------------------|
| Pageview tracking | ✅ Automatic |
| Custom events | ✅ `track()` |
| Revenue goals | ✅ With config |
| Outbound links | ✅ Auto-tracked |
| File downloads | ✅ Auto-tracked |
| 404 tracking | ✅ Auto-tracked |
| Hash-based routing | ✅ `hashMode` |
| Exclusions | ✅ `exclude` |
| Custom domains | ✅ `host` |

## Enhanced Features

### TypeScript Support

```typescript
// Type-safe event properties
track('Signup', {
  plan: 'premium',
  interval: 'monthly',
  addons: ['ssl', 'cdn'],
});
```

### Consent Management

```typescript
// Built-in GDPR compliance
import { setConsent } from 'trackkit';

// No tracking until consent
track('event'); // Queued

// User consents
setConsent('granted');
// Queued events sent automatically
```

### Error Handling

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  onError: (error) => {
    if (error.code === 'NETWORK_ERROR') {
      // Plausible might be blocked
    }
  },
});
```

## Testing Migration

### 1. Run Both in Parallel

```html
<!-- Keep Plausible -->
<script defer data-domain="yourdomain.com" 
  src="https://plausible.io/js/script.js"></script>

<!-- Add Trackkit -->
<script type="module">
  import { init } from 'trackkit';
  init({ provider: 'plausible', siteId: 'yourdomain.com' });
</script>
```

### 2. Verify in Dashboard

- Check both events appear
- Compare unique visitors
- Verify goals tracked

### 3. Remove Plausible Script

```html
<!-- Remove this -->
<script defer data-domain="yourdomain.com" 
  src="https://plausible.io/js/script.js"></script>
```

## Differences to Note

### Event Names

Plausible is case-sensitive for events:
- `'Signup'` ≠ `'signup'`
- Be consistent with naming

### Property Constraints

Plausible requires string values:
```typescript
// Trackkit handles conversion
track('Event', {
  number: 123,      // Converted to "123"
  boolean: true,    // Converted to "true"
  object: { x: 1 }, // Ignored
});
```

### No User Identification

Neither Plausible nor Trackkit's Plausible adapter support user tracking:
```typescript
identify('user-123'); // No-op with Plausible
```

## Advanced Configuration

### Custom Props Defaults

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  defaultProps: {
    version: '2.0',
    environment: 'production',
  },
});

// All events include default props
track('Feature Used'); // Includes version & environment
```

### Localhost Development

```typescript
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
  trackLocalhost: true, // Enable in development
});
```