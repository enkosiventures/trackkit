import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectBlockers } from '../../../src/dispatcher/adblocker'; // adjust import path

const never = new Promise<Response>(() => {});

describe('adblocker.detectBlockers', () => {
  let originalFetch: any;
  let originalDoc: any;
  let OriginalImage: any;

  beforeEach(() => {
    vi.useFakeTimers();
    originalFetch = (globalThis as any).fetch;
    originalDoc = (globalThis as any).document;
    OriginalImage = (globalThis as any).Image;
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).fetch = originalFetch;
    (globalThis as any).document = originalDoc;
    (globalThis as any).Image = OriginalImage;
    vi.restoreAllMocks();
  });

  function installImageLoadsOK() {
    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload && this.onload());
      }
    }
    (globalThis as any).Image = FakeImage as any;
  }

  function installImageErrors() {
    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        queueMicrotask(() => this.onerror && this.onerror());
      }
    }
    (globalThis as any).Image = FakeImage as any;
  }

  it('reports blocked via fetch when fetch to GA endpoint fails (fallback=proxy)', async () => {
    // Script check: make it no-op by removing document
    delete (globalThis as any).document;

    // DNS check: ensure it resolves quickly as "not blocked"
    installImageLoadsOK();

    // Fetch check: simulate adblock-style failure
    (globalThis as any).fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const res = await detectBlockers();
    expect(res.blocked).toBe(true);
    expect(res.method).toBe('fetch');
    expect(res.fallback).toBe('proxy');
    expect(res.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('reports not blocked when fetch succeeds and image loads', async () => {
    delete (globalThis as any).document;
    installImageLoadsOK();
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const res = await detectBlockers();
    expect(res.blocked).toBe(false);
    expect(res.fallback).toBeUndefined();
    expect(res.confidence).toBeGreaterThanOrEqual(0.7); // from image load or fetch ok
  });

  it('reports blocked via dns when pixel errors (fallback=beacon)', async () => {
    delete (globalThis as any).document;
    installImageErrors();
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const res = await detectBlockers();
    expect(res.blocked).toBe(true);
    expect(res.method).toBe('dns');
    expect(res.fallback).toBe('beacon');
  });

  it('treats fetch timeout as blocked (AbortController path)', async () => {
    delete (globalThis as any).document;
    installImageLoadsOK();
    // fetch never resolves; the internal timer resolves after ~1000ms with blocked=true
    (globalThis as any).fetch = vi.fn().mockImplementation(() => never);

    const p = detectBlockers();
    vi.advanceTimersByTime(1005);
    const res = await p;

    expect(res.blocked).toBe(true);
    expect(res.method).toBe('fetch');
    expect(res.fallback).toBe('proxy');
  });

  it('SSR-safe: no Image and no fetch do not throw and return benign result', async () => {
    delete (globalThis as any).document;
    delete (globalThis as any).fetch;
    delete (globalThis as any).Image;

    await expect(detectBlockers()).resolves.toMatchObject({
      // In SSR we get neutral/confidence 0 checks; aggregation may still pick the max of zeros
      blocked: false,
    });
  });

  it('script mode: when document exists and script errors, method=script', async () => {
    // Minimal fake document/head to trigger script.onerror quickly
    const fakeScript: any = {};
    (globalThis as any).document = {
      createElement: () => fakeScript,
      head: {
        appendChild: () => {
          // simulate async error after append
          setTimeout(() => fakeScript.onerror && fakeScript.onerror(), 0);
        },
      },
    };
    installImageLoadsOK();
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    // Start detection, then drive the 0ms timer and microtasks
    const p = detectBlockers();
    vi.advanceTimersByTime(0);
    await vi.runOnlyPendingTimersAsync(); // ensures any chained timers/microtasks run
    const res = await p;

    expect(res.blocked).toBe(true);
    expect(res.method).toBe('script');
    expect(res.fallback).toBe('proxy');
  });
});
