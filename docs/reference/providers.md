# Provider Reference

Configuration keys expected by each provider.

## Umami

**Required**
- `provider: 'umami'`
- `site` (or `website`)

**Optional**
- `host`: e.g., `https://umami.example.com`

**Events**
- `track(name, props?)`
- `pageview()`
- `identify(userId)`

## Plausible

**Required**
- `provider: 'plausible'`
- `site` (usually your domain)

**Optional**
- `host` for self-hosted Plausible

**Events**
- `track(name, props?)`
- `pageview()`
- `identify(userId)` (no-op for some providers)

## GA4

**Required**
- `provider: 'ga4'`
- `measurementId: 'G-XXXXXXX'`

**Events**
- `track(name, props?)`
- `pageview()`
- `identify(userId)` (mapped to user properties)

> All providers adhere to Trackkit’s facade contract; unsupported methods degrade gracefully (no-op) rather than throwing.
