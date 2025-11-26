import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Force hasDOM() behavior
vi.mock('../../src/util/env', () => ({ hasDOM: () => true }));

import {
  getPageUrl,
  getPathname,
  isDoNotTrackEnabled,
  isDomainAllowed,
  isUrlExcluded,
  isLocalhost,
  isPageHidden,
  getScreenResolution,
  displaySizeFromContext,
  getPageContext,
  safeStringify,
} from '../../../src/providers/browser';

const realWindow = globalThis.window as any;
const realDocument = (globalThis as any).document;

describe('browser.ts (extra)', () => {
  beforeEach(() => {
    (globalThis as any).window = {
      location: {
        href: 'https://example.com/p?q=1#h',
        pathname: '/p',
        search: '?q=1',
        hash: '#h',
        hostname: 'app.example.com',
        origin: 'https://example.com',
      },
      navigator: { language: 'en-US', languages: ['en-US', 'en'], doNotTrack: '1' },
      screen: { width: 1920, height: 1080 },
      innerWidth: 1200,
      innerHeight: 800,
    };
    (globalThis as any).document = {
      title: 'T',
      referrer: 'https://ref.example/',
      hidden: false,
      querySelector: () => null,
    };
  });

  afterEach(() => {
    (globalThis as any).window = realWindow;
    (globalThis as any).document = realDocument;
    vi.clearAllMocks();
  });

  it('getPageUrl includes or strips hash', () => {
    expect(getPageUrl(false)).toBe('/p?q=1');
    expect(getPageUrl(true)).toBe('/p?q=1#h');
  });

  it('getPathname parses URLs and falls back on invalid input (encoded)', () => {
    expect(getPathname()).toBe('/p');
    expect(getPathname('https://x.test/a/b?q=1#y')).toBe('/a/b');
    expect(getPathname('not a url')).toBe('/' + encodeURI('not a url'));
  });

  it('isDoNotTrackEnabled honors "1"/"0" (common signals)', () => {
    (globalThis as any).window.navigator.doNotTrack = '1';
    expect(isDoNotTrackEnabled()).toBe(true);
    (globalThis as any).window.navigator.doNotTrack = '0';
    expect(isDoNotTrackEnabled()).toBe(false);
  });

  it('isDomainAllowed supports exact and leading-wildcard patterns', () => {
    (globalThis as any).window.location.hostname = 'app.example.com';
    expect(isDomainAllowed(undefined)).toBe(true);
    expect(isDomainAllowed([])).toBe(true);
    expect(isDomainAllowed(['app.example.com'])).toBe(true);
    expect(isDomainAllowed(['*.example.com'])).toBe(true);
    // suffix wildcard (example.*) is NOT required by your implementation → expect false
    expect(isDomainAllowed(['example.*'])).toBe(false);
    expect(isDomainAllowed(['foo.example.com'])).toBe(false);
  });

  it('isUrlExcluded matches simple and wildcard patterns', () => {
    expect(isUrlExcluded('/products/123', ['*/123'])).toBe(true);
    expect(isUrlExcluded('/products/123', ['/products/*'])).toBe(true);
    expect(isUrlExcluded('/products/123', ['/account/*'])).toBe(false);
  });

  it('isLocalhost detects common loopback hostnames', () => {
    (globalThis as any).window.location.hostname = 'localhost';
    expect(isLocalhost()).toBe(true);
    (globalThis as any).window.location.hostname = '127.0.0.1';
    expect(isLocalhost()).toBe(true);
    (globalThis as any).window.location.hostname = 'app.example.com';
    expect(isLocalhost()).toBe(false);
  });

  it('isPageHidden and getScreenResolution reflect document/window', () => {
    (globalThis as any).document.hidden = true;
    expect(isPageHidden()).toBe(true);
    (globalThis as any).document.hidden = false;
    expect(isPageHidden()).toBe(false);

    expect(getScreenResolution()).toBe('1920x1080');
  });

  it('displaySizeFromContext prefers screenSize then viewportSize', () => {
    const ctx1 = { screenSize: { width: 100, height: 50 }, viewportSize: { width: 10, height: 5 } } as any;
    const ctx2 = { screenSize: undefined, viewportSize: { width: 10, height: 5 } } as any;
    const ctx3 = { screenSize: { width: 0, height: 0 }, viewportSize: { width: 0, height: 0 } } as any;

    expect(displaySizeFromContext(ctx1)).toBe('100x50');
    expect(displaySizeFromContext(ctx2)).toBe('10x5');
    expect(displaySizeFromContext(ctx3)).toBeUndefined();
  });

  it('getPageContext produces a coherent snapshot', () => {
    const ctx = getPageContext();
    expect(ctx.url).toBe('/p?q=1'); // canonical none → uses getPageUrl(false)
    expect(ctx.title).toBe('T');
    expect(ctx.referrer).toBe('https://ref.example/');
    expect(typeof ctx.timestamp).toBe('number');
    expect(ctx.language).toBe('en-US');
    expect(ctx.hostname).toBe('app.example.com');
  });

  it('safeStringify replaces circular refs with [Circular]', () => {
    const a: any = { x: 1 };
    a.self = a;
    const out = safeStringify(a);
    expect(out).toContain('[Circular]');
  });
});
