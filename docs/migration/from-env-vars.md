# Migrating from Hard-coded Configuration

If you're currently hard-coding analytics configuration, here's how to migrate to Trackkit's environment-based approach:

## Before

```javascript
// Hard-coded configuration
const analytics = new UmamiAnalytics({
  websiteId: 'abc-123',
  hostUrl: 'https://analytics.example.com'
});
```

## After

```javascript
// .env file
VITE_TRACKKIT_PROVIDER=umami
VITE_TRACKKIT_SITE=abc-123
VITE_TRACKKIT_HOST=https://analytics.example.com

// Your code
import { init } from 'trackkit';
const analytics = init(); // Auto-configured from env
```

## Benefits

- **Security**: Keep sensitive IDs out of source code
- **Flexibility**: Different configs per environment
- **Simplicity**: No code changes for different deployments
