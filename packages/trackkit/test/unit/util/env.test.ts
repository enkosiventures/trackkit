import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readEnvConfig } from '../../../src/util/env';
 
describe('Environment configuration', () => {
  const originalEnv = process.env;
  const originalWindow = global.window;
  const originalGlobalThis = globalThis;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // fresh window shim
    (global as any).window = { ...originalWindow };
    if (global.window) {
      (global.window as any).__TRACKKIT_ENV__ = undefined;
    }
    (globalThis as any).__TRACKKIT_ENV__ = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
    (global as any).window = originalWindow;
    (globalThis as any) = originalGlobalThis;
  });

  it('reads window.__TRACKKIT_ENV__ and prefers it over process.env (provider object wins)', () => {
    // process says "umami"
    process.env.TRACKKIT_PROVIDER = JSON.stringify({ name: 'umami', website: 'abc-123' });
    // window says "plausible" with domain + host
    (globalThis as any).__TRACKKIT_ENV__ = {
      PROVIDER: JSON.stringify({ name: 'plausible', domain: 'example.com', host: 'https://h' })
    };

    const cfg = readEnvConfig();
    expect(cfg.provider?.name).toBe('plausible'); // window wins
    expect((cfg.provider as any).domain).toBe('example.com');
    expect(cfg.provider?.host).toBe('https://h');
  });

  it('parses booleans and numbers from env', () => {
    process.env.TRACKKIT_AUTO_TRACK = 'true';
    process.env.TRACKKIT_INCLUDE_HASH = '1';
    process.env.TRACKKIT_QUEUE_SIZE = '7';

    const cfg = readEnvConfig();
    expect(cfg.autoTrack).toBe(true);
    expect(cfg.includeHash).toBe(true);
    expect(cfg.queueSize).toBe(7);
  });

  it('gives direct vars precedence over prefixed even with window absent', () => {
    delete (global.window as any).__TRACKKIT_ENV__;

    process.env.TRACKKIT_DEBUG = 'true';
    process.env.VITE_TRACKKIT_DEBUG = 'false';
    process.env.REACT_APP_TRACKKIT_DEBUG = '0';

    const cfg = readEnvConfig();
    expect(cfg.debug).toBe(true);
  });

  it('supports Vite/React prefixes for numbers/booleans too', () => {
    process.env.VITE_TRACKKIT_QUEUE_SIZE = '9';
    process.env.REACT_APP_TRACKKIT_AUTO_TRACK = 'true';
    const cfg = readEnvConfig();
    expect(cfg.queueSize).toBe(9);
    expect(cfg.autoTrack).toBe(true);
  });

  it('parses CSV lists (domains/exclude)', () => {
    process.env.TRACKKIT_DOMAINS = JSON.stringify(['a.com','b.com']);
    process.env.TRACKKIT_EXCLUDE = JSON.stringify(['^/private', '/admin']);
    const cfg = readEnvConfig();
    expect(cfg.domains).toEqual(['a.com', 'b.com']);
    expect(cfg.exclude).toEqual(['^/private', '/admin']);
  });

  it('parses JSON collections for batching / resilience / connection / consent / performance', () => {
    process.env.TRACKKIT_CONSENT = JSON.stringify({ initialStatus: 'pending', requireExplicit: true });
    process.env.TRACKKIT_DISPATCHER = JSON.stringify({
      batching: { enabled: true, maxSize: 2, maxWait: 10 },
      resilience: { detectBlockers: true, retry: { maxAttempts: 5 } },
      connection: { monitor: true, slowThreshold: 2000, checkInterval: 15000 },
      performance: { enabled: true, sampleRate: 0.25 },
    });

    const cfg = readEnvConfig();
    expect(cfg.dispatcher?.batching).toEqual({ enabled: true, maxSize: 2, maxWait: 10 });
    expect(cfg.dispatcher?.resilience?.detectBlockers).toBe(true);
    expect(cfg.dispatcher?.resilience?.retry?.maxAttempts).toBe(5);
    expect(cfg.dispatcher?.connection).toEqual({ monitor: true, slowThreshold: 2000, checkInterval: 15000 });
    expect(cfg.consent).toEqual({ initialStatus: 'pending', requireExplicit: true });
    expect(cfg.dispatcher?.performance).toEqual({ enabled: true, sampleRate: 0.25 });
  });

  it('accepts provider-specific shapes via JSON (GA4, Umami, Plausible)', () => {
    process.env.TRACKKIT_PROVIDER = JSON.stringify({ name: 'ga4', measurementId: 'G-123', debugMode: true });
    let cfg = readEnvConfig();
    expect(cfg.provider?.name).toBe('ga4');
    expect((cfg.provider as any).measurementId).toBe('G-123');
    expect((cfg.provider as any).debugMode).toBe(true);

    process.env.TRACKKIT_PROVIDER = JSON.stringify({ name: 'umami', website: 'abcd-efgh' });
    cfg = readEnvConfig();
    expect(cfg.provider?.name).toBe('umami');
    expect((cfg.provider as any).website).toBe('abcd-efgh');

    process.env.TRACKKIT_PROVIDER = JSON.stringify({ name: 'plausible', domain: 'example.com', defaultProps: { plan: 'pro' } });
    cfg = readEnvConfig();
    expect(cfg.provider?.name).toBe('plausible');
    expect((cfg.provider as any).domain).toBe('example.com');
    expect((cfg.provider as any).defaultProps).toEqual({ plan: 'pro' });
  });

  it('handles malformed JSON gracefully by leaving fields undefined', () => {
    process.env.TRACKKIT_DISPATCHER = '{bad json';
    process.env.TRACKKIT_PROVIDER = '{also bad';
    const cfg = readEnvConfig();
    expect(cfg.dispatcher).toBeUndefined();
    expect(cfg.provider).toBeUndefined();
  });
});
