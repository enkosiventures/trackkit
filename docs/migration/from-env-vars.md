# Migrating from Hard-coded Configuration

Move provider settings out of source and into environment/runtime config.

## Before

```ts
// Hard-coded
const analytics = new UmamiAnalytics({
  websiteId: 'abc-123',
  hostUrl: 'https://analytics.example.com'
});
```

## After (Build-time env)

```env
# .env
TRACKKIT_PROVIDER=umami
TRACKKIT_SITE=abc-123
TRACKKIT_HOST=https://analytics.example.com
```

```ts
import { init } from 'trackkit';
const analytics = init(); // Auto-configured from env
```

## After (Runtime injection)

When you can’t rebuild per environment:

```html
<script>
  window.__TRACKKIT_ENV__ = {
    PROVIDER: "umami",
    SITE: "abc-123",
    HOST: "https://analytics.example.com"
  };
</script>
```

## Benefits

* **Security:** Keep IDs out of source code & bundles
* **Flexibility:** Per-environment without code changes
* **Speed:** Promote config changes at the edge/CDN
