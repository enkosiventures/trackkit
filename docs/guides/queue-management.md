# Queue Management

Trackkit automatically queues events in several scenarios to ensure no data is lost.

## Queue Scenarios

### 1. Pre-initialization Queue

Events tracked before `init()` are automatically queued:

```typescript
// These calls are queued
track('early_event');
pageview('/landing');

// Initialize - queued events are processed
const analytics = init({ provider: 'umami' });
```

### 2. Provider Loading Queue

While providers are loading asynchronously, events are queued:

```typescript
const analytics = init({ provider: 'umami' });

// This might be queued if provider is still loading
track('quick_event');

// Wait for ready if you need synchronous behavior
await waitForReady();
track('guaranteed_processed');
```

### 3. Consent Pending Queue

Events are queued when consent is not yet granted:

```typescript
const analytics = init();

// Queued until consent granted
track('waiting_for_consent');

// Events are flushed
analytics.setConsent('granted');
```

## Queue Configuration

```typescript
init({
  queueSize: 100, // Maximum events to queue (default: 50)
  onError: (error) => {
    if (error.code === 'QUEUE_OVERFLOW') {
      console.warn('Analytics queue full');
    }
  }
});
```

## Queue Monitoring

For debugging, access queue state:

```typescript
const analytics = init({ debug: true });
const state = (analytics as any).getState();

console.log({
  queueSize: state.queue.size,
  isPaused: state.queue.isPaused,
  providerState: state.provider
});
```

## Server-Side Rendering (SSR)

In SSR environments, events are collected in a global queue:

```typescript
// Server-side
import { track, serializeSSRQueue } from 'trackkit';

track('server_render', { page: '/product' });

// In your HTML template
const html = `
  <!DOCTYPE html>
  <html>
    <head>
      ${serializeSSRQueue()}
    </head>
    ...
  </html>
`;
```

The client automatically processes SSR events on initialization.
