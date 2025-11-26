# Provider Reference

Configuration keys expected by each provider. This is a quick reference only.

For full behaviour (consent, queueing, SSR, transports, policy), see the individual provider guides.

## Umami

**Required**
- `provider: 'umami'`
- `site` (or `website`)

**Optional**
- `host`: e.g., `https://umami.example.com`

**Events**
- `track(name, props?)`
- `pageview()`
- `identify(userId)` (no-op; included only for API compatibility)

## Plausible

**Required**
- `provider: 'plausible'`
- `site` (usually your domain)

**Optional**
- `host` for self-hosted Plausible

**Events**
- `track(name, props?)`
- `pageview()`
- `identify(userId)` (no-op for Plausible; included for API compatibility)

## GA4

**Required**
- `provider: 'ga4'`
- `measurementId: 'G-XXXXXXX'`

**Events**
- `track(name, props?)`
- `pageview()`
- `identify(userId)` (mapped to user properties)

> All providers adhere to Trackkit’s facade contract; unsupported methods degrade gracefully (no-op) rather than throwing.
