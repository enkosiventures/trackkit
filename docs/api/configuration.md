# Configuration

Trackkit can be configured through environment variables or programmatically.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRACKKIT_PROVIDER` | Analytics provider to use | `noop` |
| `TRACKKIT_SITE_ID` | Provider-specific site identifier | - |
| `TRACKKIT_HOST` | Custom analytics host | Provider default |
| `TRACKKIT_QUEUE_SIZE` | Maximum events to buffer | `50` |
| `TRACKKIT_DEBUG` | Enable debug logging | `false` |

### Build Tool Support

- **Vite**: Use `VITE_TRACKKIT_*` prefix
- **Create React App**: Use `REACT_APP_TRACKKIT_*` prefix
- **Next.js**: Use `NEXT_PUBLIC_TRACKKIT_*` prefix

### Runtime Configuration

For dynamic configuration, inject a global config object:

```html
<script>
  window.__TRACKKIT_ENV__ = {
    PROVIDER: 'umami',
    SITE_ID: 'your-site-id',
    DEBUG: 'true'
  };
</script>
```

## Error Handling

Configure error callbacks to monitor SDK issues:

```typescript
init({
  onError: (error) => {
    console.error('Analytics error:', error.code, error.message);
    
    // Send to error tracking service
    Sentry.captureException(error);
  }
});
```

## Debug Mode

Enable comprehensive logging for development:

```typescript
init({ debug: true });

// Or via environment
TRACKKIT_DEBUG=true npm start
```
