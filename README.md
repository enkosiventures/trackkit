# Trackkit

<p align="center">
  <strong>A tiny, privacy-first analytics toolkit for the modern web</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/trackkit"><img src="https://img.shields.io/npm/v/trackkit.svg?style=flat-square" alt="npm version"></a>
  <a href="https://bundlephobia.com/package/trackkit"><img src="https://img.shields.io/bundlephobia/minzip/trackkit?style=flat-square" alt="bundle size"></a>
  <a href="https://github.com/your-org/trackkit/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/trackkit.svg?style=flat-square" alt="license"></a>
  <a href="https://github.com/your-org/trackkit/actions"><img src="https://img.shields.io/github/actions/workflow/status/your-org/trackkit/ci.yml?style=flat-square" alt="build status"></a>
</p>

<p align="center">
  <code>npm i trackkit</code> • <a href="#quick-start">Quick Start</a> • <a href="./docs">Docs</a> • <a href="#examples">Examples</a>
</p>

---

## Why Trackkit?

- **Tiny footprint** - Core is just ~7KB (gzipped), tree-shakeable to ~2KB
- **Privacy-first** - GDPR-compliant with built-in consent management
- **Type-safe** - Full TypeScript support with event type inference
- **Fast** - Lazy-loaded providers, smart batching, minimal overhead
- **Flexible** - Support for Umami, Plausible, GA4, and more
- **Universal** - Works in browsers, Node.js, workers, and extensions

```typescript
// One API, multiple providers
import { init, track } from 'trackkit';

init({ provider: 'umami', siteId: 'my-site' });
track('checkout_completed', { value: 99.99 });
```

---

## Features

### 🎛️ Multi-Provider Support
Switch between analytics providers without changing your code:

```typescript
// Umami (privacy-first, self-hosted)
init({ provider: 'umami', siteId: 'uuid' });

// Plausible (privacy-first, lightweight)  
init({ provider: 'plausible', siteId: 'domain.com' });

// Google Analytics 4 (feature-rich)
init({ provider: 'ga', siteId: 'G-XXXXXX' });
```

### 🛡️ Built-in Consent Management
Respect user privacy with intelligent consent handling:

```typescript
import { track, grantConsent, denyConsent } from 'trackkit';

// Events are queued until consent is granted
track('page_viewed'); // Queued

// User makes a choice
grantConsent(); // All queued events are sent

// Or they decline
denyConsent(); // Queue cleared, no tracking
```

### 📦 Tree-Shakeable Imports
Import only what you need for minimal bundle impact:

```typescript
// Just tracking? ~2KB
import track from 'trackkit/methods/track';

// Just consent? ~1KB  
import { grantConsent } from 'trackkit/methods/grantConsent';
```

### 🔍 Type-Safe Events
Define your events once, get autocompletion everywhere:

```typescript
type MyEvents = {
  'item_purchased': { item_id: string; price: number; currency: string };
  'search_performed': { query: string; results_count: number };
};

const analytics = init() as TypedAnalytics<MyEvents>;

// TypeScript ensures correct event properties
analytics.track('item_purchased', {
  item_id: 'SKU-123',
  price: 29.99,
  currency: 'USD' // ✅ All required fields enforced
});
```

### 🚀 SSR Support
Server-side rendering with automatic hydration:

```typescript
// Server
track('server_render', { path: '/products' });

// Client - automatically hydrates queued events
init({ provider: 'umami' });
```

---

## Quick Start

### Installation

```bash
npm install trackkit
# or
pnpm add trackkit
# or  
yarn add trackkit
```

### Basic Usage

```typescript
import { init, track, pageview } from 'trackkit';

// Initialize analytics
init({
  provider: 'plausible',
  siteId: 'yourdomain.com',
});

// Track page views
pageview();

// Track custom events
track('signup_completed', {
  plan: 'premium',
  referrer: 'blog'
});
```

### React

```tsx
import { AnalyticsProvider, useAnalytics } from 'trackkit-react';

function App() {
  return (
    <AnalyticsProvider options={{ provider: 'umami', siteId: 'xxx' }}>
      <Button />
    </AnalyticsProvider>
  );
}

function Button() {
  const { track } = useAnalytics();
  return (
    <button onClick={() => track('button_clicked')}>
      Click me
    </button>
  );
}
```

### Vue

```vue
<script setup>
import { useAnalytics } from 'trackkit-vue';

const { track } = useAnalytics();

function handleClick() {
  track('button_clicked', { location: 'hero' });
}
</script>

<template>
  <button @click="handleClick">Click me</button>
</template>
```

---

## Documentation

- **[Core SDK Documentation](./packages/trackkit/README.md)** - API reference and configuration
- **[React Integration](./packages/trackkit-react/README.md)** - React hooks and components
- **[Vue Integration](./packages/trackkit-vue/README.md)** - Vue plugin and composables
- **[Choosing a Provider](./docs/guides/choosing-provider.md)** - Comparison of analytics providers
- **[Migration Guides](./docs/migration/)** - Migrate from gtag, Plausible, etc.
- **[Examples](./examples/)** - Sample applications and use cases

---

## Examples

### Basic Website
```bash
cd examples/vite-site
pnpm install
pnpm dev
```

### Chrome Extension (MV3)
```bash
cd examples/mv3-extension  
pnpm install
pnpm build
# Load dist/ folder in Chrome
```

### Next.js App
```bash
cd examples/nextjs-app
pnpm install  
pnpm dev
```

---

## Packages

This is a monorepo containing multiple packages:

| Package | Version | Size | Description |
|---------|---------|------|-------------|
| [`trackkit`](./packages/trackkit) | ![npm](https://img.shields.io/npm/v/trackkit.svg?style=flat-square) | ![size](https://img.shields.io/bundlephobia/minzip/trackkit?style=flat-square) | Core analytics SDK |
| [`trackkit-react`](./packages/trackkit-react) | ![npm](https://img.shields.io/npm/v/trackkit-react.svg?style=flat-square) | ![size](https://img.shields.io/bundlephobia/minzip/trackkit-react?style=flat-square) | React integration |
| [`trackkit-vue`](./packages/trackkit-vue) | ![npm](https://img.shields.io/npm/v/trackkit-vue.svg?style=flat-square) | ![size](https://img.shields.io/bundlephobia/minzip/trackkit-vue?style=flat-square) | Vue integration |

---

## Comparison

### vs Google Analytics

- ✅ **10x smaller** - 7KB vs 70KB
- ✅ **Privacy-first** - No cookies by default
- ✅ **Simpler API** - Just 4 main methods
- ✅ **Type-safe** - Full TypeScript support
- ❌ **Less features** - No audience builder, etc.

### vs Plausible/Umami Scripts

- ✅ **Unified API** - Same code for any provider
- ✅ **Better DX** - TypeScript, tree-shaking, errors
- ✅ **Consent built-in** - GDPR compliance made easy
- ✅ **Framework support** - React/Vue integrations
- ➖ **Slightly larger** - Due to abstraction layer

### When to use Trackkit

- 👍 You want provider flexibility
- 👍 You need type-safe analytics
- 👍 You care about bundle size
- 👍 You need SSR support
- 👍 You want built-in consent management

### When NOT to use Trackkit

- 👎 You need advanced GA4 features (audiences, funnels)
- 👎 You're happy with your current setup
- 👎 You only use one provider forever
- 👎 You need real-time dashboards (use provider directly)

---

## Development

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/trackkit.git
cd trackkit

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development
pnpm dev
```

### Project Structure

```
trackkit/
├── packages/
│   ├── trackkit/          # Core SDK
│   ├── trackkit-react/    # React wrapper
│   └── trackkit-vue/      # Vue wrapper
├── examples/
│   ├── vite-site/         # Basic example
│   ├── nextjs-app/        # Next.js example
│   └── mv3-extension/     # Chrome extension
├── docs/                  # Documentation
└── scripts/               # Build tools
```

### Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

### Development Commands

```bash
# Watch mode for all packages
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Bundle size check
pnpm size

# Build for production
pnpm build
```

---

## Bundle Size

We take bundle size seriously. Our CI enforces these limits:

| Export | Size Limit | Actual | Status |
|--------|------------|--------|--------|
| Core (ESM) | 8 KB | 6.9 KB | ✅ |
| Core (CJS) | 8 KB | 6.9 KB | ✅ |
| Track only | 2 KB | 2.0 KB* | ✅ |
| React wrapper | 1 KB | 0.85 KB | ✅ |
| Vue wrapper | 1 KB | 0.90 KB | ✅ |

*When tree-shaking works correctly

---

## Security

- No cookies stored by default (provider-dependent)
- No PII collection without explicit calls
- All network requests use HTTPS
- CSP compliant (no inline scripts)
- Supports strict Content Security Policies

### Reporting Security Issues

Please email security@trackkit.dev for any security concerns.

---

## License

MIT © 2024 Trackkit Contributors

See [LICENSE](./LICENSE) for details.

---

## Support

- 📚 [Documentation](https://trackkit.dev/docs)
- 💬 [Discord Community](https://discord.gg/trackkit)
- 🐛 [Issue Tracker](https://github.com/your-org/trackkit/issues)
- 📧 [Email Support](mailto:support@trackkit.dev)

---

<p align="center">
  <sub>Built with ❤️ by developers who care about privacy and performance</sub>
</p>