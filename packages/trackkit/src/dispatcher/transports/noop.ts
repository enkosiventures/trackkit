import type { DispatchPayload, Transport } from '../types';

export class NoopTransport implements Transport {
  id = 'noop-transport';

  constructor(
    private readonly onSend?: (payload: DispatchPayload) => void
  ) {}

  async send(payload: DispatchPayload): Promise<void> {
    console.warn('[NoopTransport] send() called with payload:', payload);
    // Optional: invoke callback for diagnostics/playground log
    if (this.onSend) {
      try { this.onSend(payload); } catch { /* swallow */ }
    }
    // Nothing actually sent
  }
}
