import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readEnvConfig } from '../../../src/util/env';

describe('Environment configuration', () => {
  const originalEnv = process.env;
  const originalWindow = global.window;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // fresh window shim
    (global as any).window = { ...originalWindow };
    if (global.window) {
      (global.window as any).__TRACKKIT_ENV__ = undefined;
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    (global as any).window = originalWindow;
  });

  it('reads window.__TRACKKIT_ENV__ and prefers it over process.env', () => {
    process.env.TRACKKIT_PROVIDER = 'umami';
    globalThis.__TRACKKIT_ENV__ = { PROVIDER: 'plausible', HOST: 'https://h' };

    const config = readEnvConfig();
    expect(config.provider).toBe('plausible'); // window wins
    expect(config.host).toBe('https://h');
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

  // If your readEnvConfig supports CSV lists for allow/deny lists, add:
  // it('parses CSV lists (domains/exclude) when provided', () => {
  //   process.env.TRACKKIT_DOMAINS = 'a.com,b.com';
  //   process.env.TRACKKIT_EXCLUDE = '^/private, /admin';
  //   const cfg = readEnvConfig();
  //   expect(cfg.domains).toEqual(['a.com', 'b.com']);
  //   expect(cfg.exclude).toEqual(['^/private', '/admin']); // or regex transform if you apply it
  // });
});
