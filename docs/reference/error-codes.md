# Error Codes

Trackkit surfaces typed `AnalyticsError` objects via your `onError` callback.

| Code               | When it happens                                                                 | Typical action |
|--------------------|---------------------------------------------------------------------------------|----------------|
| `INIT_FAILED`      | Provider init failed (invalid config, script blocked, or runtime init error)    | Inspect `error.originalError`, verify env/host, check ad blockers |
| `INVALID_CONFIG`   | Configuration failed validation before init                                     | Fix configuration (wrong provider, missing `site`/`measurementId`, etc.) |
| `INVALID_ENVIRONMENT` | Environment unsupported (e.g., non-browser where provider requires DOM APIs) | Avoid calling analytics in unsupported contexts or guard usage |
| `PROVIDER_ERROR`   | Provider method threw while sending                                             | Log & optionally retry (Stage 7 adds structured retry) |
| `NETWORK_ERROR`    | Transport failed due to network issues (after retries/backoff)                  | Log; consider surfacing degraded analytics state to monitoring |
| `POLICY_BLOCKED`   | Event blocked by policy (DNT, localhost policy, domain/exclude rules, denied consent) | Adjust config or handle gracefully (may be expected) |
| `CONSENT_REQUIRED` | Operation requires consent that has not been granted                            | Prompt user again or avoid calling until consent is known |
| `QUEUE_OVERFLOW`   | In-memory queue exceeded `queueSize`                                            | Increase queue or reduce pre-consent volume |
| `READY_TIMEOUT`    | Provider did not become ready within the expected time                          | Investigate provider loading, CSP, or blocker interference |
| `TIMEOUT`          | Generic timeout from an internal async operation                                | Log & investigate; should be rare |
| `UNKNOWN`          | Fallback for unexpected errors                                                  | Log full error; consider reporting to Trackkit maintainers |

Each error includes:
```ts
{ 
    name: 'AnalyticsError',
    code,
    message,
    provider?,
    timestamp,
    originalError?,
}
```
