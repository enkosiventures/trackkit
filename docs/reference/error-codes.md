# Error Codes

Trackkit surfaces typed `AnalyticsError` objects via your `onError` callback.

| Code | When it happens | Typical action |
|------|------------------|----------------|
| `INIT_FAILED` | Provider config invalid, script blocked, or runtime init error | Inspect `error.cause`, verify env/host, check ad blockers |
| `PROVIDER_ERROR` | Provider method threw while sending | Log & retry (Stage 7 adds structured retry) |
| `POLICY_BLOCKED` | Event blocked by policy (DNT, localhost policy, domain/exclude rules, denied consent) | Adjust config or handle gracefully |
| `QUEUE_OVERFLOW` | In-memory queue exceeded `queueSize` | Increase queue or reduce pre-consent volume |

Each error includes `{ code, message, provider?, cause? }`.
