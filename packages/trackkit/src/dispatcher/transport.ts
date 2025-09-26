export interface Transport {
  send(url: string, payload: any, init?: RequestInit): Promise<Response | void>;
}

export class FetchTransport implements Transport {
  async send(url: string, payload: any, init: RequestInit = {}) {
    const { headers: hdrs, ...rest } = init;
    const mergedHeaders = {
      'Content-Type': 'application/json',
      ...(hdrs instanceof Headers ? Object.fromEntries(hdrs.entries()) : (hdrs as Record<string, any>)),
    };

    return fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      ...rest,
      headers: mergedHeaders,
    });
  }
}

export class BeaconTransport implements Transport {
  async send(url: string, payload: any) {
    if (navigator?.sendBeacon) {
      navigator.sendBeacon(
        url,
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
    }
  }
}