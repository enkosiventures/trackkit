import type { DispatchPayload, Transport } from "../types";


export class BeaconTransport implements Transport {
  id = 'beacon_' + Math.random().toString(36).substring(2, 8);

  async send(payload: DispatchPayload): Promise<void> {
    if (typeof navigator?.sendBeacon === 'function') {
      navigator.sendBeacon(
        payload.url,
        new Blob([JSON.stringify(payload.body)], { type: 'application/json' }),
      );
    }
  }
}
