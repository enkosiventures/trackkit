import type { DispatchPayload, Transport } from '../types';


export class FetchTransport implements Transport {
  id = 'fetch_' + Math.random().toString(36).substring(2, 8);

  async send(payload: DispatchPayload): Promise<Response | void> {
    const { headers: hdrs, ...rest } = payload.init || {};
    const mergedHeaders = {
      'Content-Type': 'application/json',
      ...(hdrs instanceof Headers ? Object.fromEntries(hdrs.entries()) : (hdrs as Record<string, any>)),
    };
    return fetch(payload.url, {
      method: 'POST',
      body: JSON.stringify(payload.body),
      ...rest,
      headers: mergedHeaders,
    });
  }
}
