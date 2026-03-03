# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Trackkit follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from **1.0.0** onwards.
During the **0.x beta**, breaking changes may occur between minor versions and will be noted here.

---

## [Unreleased]

### Added

- Export `ConsentStoredState` from the main `trackkit` entry point (`src/index.ts`). Previously accessible only as an internal type; now importable as `import type { ConsentStoredState } from 'trackkit'`.
- Export `DiagnosticsSnapshot` from the main `trackkit` entry point. Previously required a direct import from `facade/diagnostics`; now importable as `import type { DiagnosticsSnapshot } from 'trackkit'`.

### Changed

- **Breaking (docs):** Provider configuration now uses a nested `provider` object rather than a top-level string plus loose fields.

  Before (was documented incorrectly, never actually worked):
  ```ts
  createAnalytics({ provider: 'umami', site: 'abc', host: 'https://...' });
  ```

  After (correct, matches the actual `ProviderOptions` discriminated-union type):
  ```ts
  createAnalytics({ provider: { name: 'umami', site: 'abc', host: 'https://...' } });
  ```

  Provider-specific fields (`site`, `host`, `website`, `domain`, `measurementId`, `apiSecret`, etc.) belong inside the `provider` object. Facade-level fields (`autoTrack`, `debug`, `doNotTrack`, `queueSize`, `consent`, etc.) remain at the top level.

- **Docs:** The correct configuration type name is `AnalyticsOptions` (not `InitOptions`, which does not exist). All documentation references updated.

### Fixed

- **API reference corrections** (`docs/reference/api.md`):
  - `track()` third parameter is `category?: ConsentCategory`, not `url?`.
  - `identify()` signature is `identify(userId: string | null)` — no `traits` parameter.
  - `pageview()` signature is `pageview(url?: string)` — no structured object form.
  - `waitForReady()` accepts `opts?: { timeoutMs?: number; mode?: string }`, not a bare `timeoutMs` number.
  - `getConsent()` returns `ConsentStoredState | null`, not `ConsentStoredState | undefined`.
  - `onConsentChange()` handler receives `(status: ConsentStatus, prev: ConsentStatus)`, not `(state: ConsentStoredState)`.
  - Removed `setConsent()` from the public API docs. Use `grantConsent()`, `denyConsent()`, or `resetConsent()` instead.

- **SSR example** (`packages/trackkit/README.md`): Corrected a misleading example that called `ssrTrack('pageview', { url: '/home' })` — this would create a custom event named `"pageview"`, not a proper SSR pageview. The correct call is `ssrPageview('/home')`.

- All documentation code examples updated to use the correct nested provider config syntax (see above).

---

## [0.0.1] — Initial pre-release

First tracked revision. Internal beta only.
