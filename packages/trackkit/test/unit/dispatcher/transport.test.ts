import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchTransport, BeaconTransport } from '../../../src/dispatcher/transport';

describe('Transport', () => {
  beforeEach(() => { (globalThis as any).fetch = vi.fn(async () => ({ ok: true, status: 200 })); });
  afterEach(() => { (globalThis as any).fetch = undefined; });

  it('FetchTransport posts JSON payload', async () => {
    const t = new FetchTransport();
    await t.send('/endpoint', { a: 1 }, { headers: { 'X-Test': 'yes' } });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe('/endpoint');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });

  it('BeaconTransport sends via navigator.sendBeacon when available', async () => {
    const beaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beaconSpy, configurable: true });

    const t = new BeaconTransport();
    await t.send('/endpoint', { x: 1 });

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [url, blob] = beaconSpy.mock.calls[0];
    expect(url).toBe('/endpoint');
    expect(blob).toBeInstanceOf(Blob);
  });
});
