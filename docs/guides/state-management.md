# Provider State Management

Trackkit manages provider lifecycle through a state machine to ensure reliable operation.

## Provider States

```
idle → initializing → ready → destroyed
         ↓
       (error)
         ↓
        idle
```

### State Descriptions

- **idle**: Provider created but not initialized
- **initializing**: Provider loading/connecting
- **ready**: Provider operational, events processed immediately  
- **destroyed**: Terminal state, instance cleaned up

## Waiting for Ready State

```typescript
import { init, waitForReady } from 'trackkit';

// Option 1: Async/await
async function setupAnalytics() {
  init({ provider: 'umami' });
  await waitForReady();
  
  // Provider guaranteed ready
  track('app_loaded');
}

// Option 2: Fire and forget
init({ provider: 'umami' });
track('event'); // Automatically queued if not ready
```

## State Monitoring

Monitor state changes for debugging:

```typescript
const analytics = init({ debug: true });

// Check current state
const state = (analytics as any).getState();
console.log(state.provider); // 'ready'
console.log(state.history);  // State transition history
```

## Error Recovery

Providers automatically fall back to 'idle' state on initialization errors:

```typescript
init({
  provider: 'umami',
  host: 'https://invalid.example.com',
  onError: (error) => {
    if (error.code === 'INIT_FAILED') {
      // Provider failed to initialize
      // Falls back to no-op provider
    }
  }
});
```

## Preloading Providers

Warm up provider code before initialization:

```typescript
import { preload, init } from 'trackkit';

// Preload provider bundle
await preload('umami');

// Later initialization is faster
init({ provider: 'umami' });
```
