import type { DispatchPayload, ProxyTransportOptions, Transport } from '../types';


export class ProxiedTransport implements Transport {
  id = 'proxy_' + Math.random().toString(36).substring(2, 8);

  constructor(private opts: ProxyTransportOptions) {
    if (!opts.proxyUrl) throw new Error('ProxiedTransport: proxyUrl is required');
  }

  private isAllowed(target: string) {
    const { allowlist } = this.opts;
    if (!allowlist || allowlist.length === 0) return true;
    return allowlist.some(rule => {
      if (typeof rule === 'string') return target.startsWith(rule);
      return rule.test(target);
    });
  }

  async send(payload: DispatchPayload): Promise<Response> {
    const { url, init } = payload;
    const safeInit = init || {};
    if (!this.isAllowed(url)) {
      throw new Error(`ProxiedTransport: target not allowed: ${url}`);
    }

    const baseHeaders: Record<string,string> = {
      'Content-Type': 'application/json',
      'X-Trackkit-Target': url,
    };
    if (this.opts.token) baseHeaders['Authorization'] = `Bearer ${this.opts.token}`;
    if (this.opts.headers) Object.assign(baseHeaders, this.opts.headers);

    const userHeaders = safeInit.headers instanceof Headers
      ? Object.fromEntries(safeInit.headers.entries())
      : (safeInit.headers as Record<string, string> | undefined);

    const headers = { ...baseHeaders, ...(userHeaders || {}) };

    const passthrough: RequestInit = {
      cache: safeInit.cache,
      credentials: safeInit.credentials,
      integrity: safeInit.integrity,
      keepalive: this.opts.keepalive ?? safeInit.keepalive,
      mode: safeInit.mode,
      redirect: safeInit.redirect,
      referrer: safeInit.referrer,
      referrerPolicy: safeInit.referrerPolicy,
      signal: safeInit.signal,
    };

    return fetch(this.opts.proxyUrl, {
      method: 'POST',
      ...passthrough,
      headers,
      body: JSON.stringify(payload.body),
    });
  }
}
