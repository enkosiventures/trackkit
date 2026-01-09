import { logger } from '../../util/logger';
import type { DispatchPayload, Transport } from '../types';

export class NoopTransport implements Transport {
  id = 'noop-transport';

  constructor(
    private readonly onSend?: (payload: DispatchPayload) => void
  ) {}

  async send(payload: DispatchPayload): Promise<void> {
    logger.debug('[NoopTransport] send() called with payload:', payload);
    if (this.onSend) {
      try { this.onSend(payload); } catch { /* swallow */ }
    }
    // Nothing actually sent
  }
}
