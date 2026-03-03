import { getId } from "../../util";
import type { DispatchPayload, Transport } from "../types";


export class BeaconTransport implements Transport {
  id = 'beacon_' + getId();

  async send(payload: DispatchPayload): Promise<void> {
    const bodyString = typeof payload.body === 'string' 
      ? payload.body 
      : JSON.stringify(payload.body);

    if (typeof navigator?.sendBeacon === 'function') {
      const blob = new Blob([bodyString], { type: 'application/json' });
      // sendBeacon returns false if the browser refused to queue the request
      const queued = navigator.sendBeacon(payload.url, blob);
      if (queued) return;
    }

    // Fallback path: Queue full or API missing. 
    // Use classic fetch with keepalive to best mimic beacon behavior.
    const res = await fetch(payload.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.init?.headers || {}),
      },
      body: bodyString,
      keepalive: true,
    });

    if (!res.ok) {
       // Throw so the dispatcher's retry logic can kick in if configured
       throw new Error(`Beacon fallback failed: ${res.status} ${res.statusText}`);
    }
  }
}
