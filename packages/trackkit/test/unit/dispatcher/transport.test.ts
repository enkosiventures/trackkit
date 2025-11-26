import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchTransport, ProxiedTransport, BeaconTransport } from '../../../src/dispatcher/transports';


const g = globalThis as any;

describe('Transport', () => {
  beforeEach(() => { (globalThis as any).fetch = vi.fn(async () => ({ ok: true, status: 200 })); });
  afterEach(() => { (globalThis as any).fetch = undefined; });

  it('FetchTransport posts JSON payload', async () => {
    const t = new FetchTransport();
    await t.send({
      url: '/endpoint',
      body: { a: 1 },
      init: { headers: { 'X-Test': 'yes' } },
    });

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
    await t.send({
      url: '/endpoint',
      body: { x: 1 },
    });

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [url, blob] = beaconSpy.mock.calls[0];
    expect(url).toBe('/endpoint');
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('ProxiedTransport', () => {
  const proxyUrl = '/api/trackkit';

  beforeEach(() => {
    g.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete g.fetch;
  });

  it('POSTs to the proxy URL with JSON {payload} and X-Trackkit-Target', async () => {
    const t = new ProxiedTransport({ proxyUrl });
    const body = { hello: 'world' };
    await t.send({ url: 'https://events.example.com/ingest', body});

    expect(g.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = g.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(proxyUrl);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Trackkit-Target': 'https://events.example.com/ingest',
    });

    const sentBody = JSON.parse(String(init?.body));
    expect(body).toEqual(sentBody);
  });

  it('merges token and extra headers and per-call headers', async () => {
    const t = new ProxiedTransport({
      proxyUrl,
      token: 's3cr3t',
      headers: { 'X-App': 'docs' },
    });

    await t.send({
      url: 'https://events.example.com/ingest',
      body: { x: 1 },
      init: { headers: { 'X-Request-ID': 'abc' }},
    });

    const [, init] = g.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Trackkit-Target': 'https://events.example.com/ingest',
      'Authorization': 'Bearer s3cr3t',
      'X-App': 'docs',
      'X-Request-ID': 'abc',
    });
  });

  it('enforces allowlist when provided', async () => {
    const t = new ProxiedTransport({
      proxyUrl,
      allowlist: [/^https:\/\/events\.good\.com\//, 'https://allowed.io/'],
    });

    await expect(
      t.send({ url: 'https://events.good.com/ok', body: {} })
    ).resolves.toBeDefined();

    await expect(
      t.send({ url: 'https://blocked.bad.com/deny', body: {} })
    ).rejects.toThrow(/not allowed/i);
  });

  it('respects keepalive option for nicer unload semantics', async () => {
    const t = new ProxiedTransport({ proxyUrl, keepalive: true });
    await t.send({ url: 'https://events.example.com/ingest', body: {} });
    const [, init] = g.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
  });

  it('passes through selected RequestInit fields', async () => {
    const t = new ProxiedTransport({ proxyUrl });
    await t.send({
      url: 'https://events.example.com/ingest',
      body: {},
      init: {
        cache: 'no-store',
        credentials: 'include',
        mode: 'cors',
        redirect: 'follow',
        referrer: 'about:client',
        referrerPolicy: 'no-referrer',
        integrity: 'sha256-deadbeef',
      }
    });

    const [, init] = g.fetch.mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('include');
    expect(init.mode).toBe('cors');
    expect(init.redirect).toBe('follow');
    expect(init.referrer).toBe('about:client');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.integrity).toBe('sha256-deadbeef');
  });

  it('throws if constructed without endpoint', () => {
    // @ts-expect-error intentional
    expect(() => new ProxiedTransport({})).toThrow(/ProxiedTransport: proxyUrl is required/i);
  });
});
