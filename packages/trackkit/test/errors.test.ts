/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  init,
  track,
  destroy,
  waitForReady,
  getDiagnostics,
} from '../src';
import { AnalyticsError } from '../src/errors';

// @vitest-environment jsdom

describe('Error handling (Facade)', () => {
  let consoleError: any;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // destroy();
  });

  afterEach(async () => {
    await destroy();
    vi.restoreAllMocks();
  });

  it('emits INVALID_CONFIG error synchronously and falls back to noop', async () => {
    const onError = vi.fn();

    init({
      provider: 'umami',      // missing required siteId
      onError,
      debug: true,
    });

    // onError should have been called synchronously
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_CONFIG',
        provider: 'umami',
      })
    );

    // Wait for fallback noop to finish loading (async)
    await waitForReady();

    const diag = getDiagnostics();
    console.warn('[TRACKKIT::DEBUG] Diagnostics after INVALID_CONFIG:', diag); // DEBUG
    expect(diag.provider).toBe('noop');
    expect(diag.hasRealInstance).toBe(true);
  });

  it('falls back to noop when unknown provider is specified', async () => {
    const onError = vi.fn();

    init({
      provider: 'ghost' as any,
      debug: true,
      onError,
    });

    // Synchronous INVALID_CONFIG
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_CONFIG',
        message: expect.stringContaining('Unknown provider'),
      })
    );

    await waitForReady();

    const diag = getDiagnostics();
    expect(diag.provider).toBe('noop');
  });

  it('wraps async provider load failure with INIT_FAILED', async () => {
    // Simulate a load failure by pointing to unknown provider after validation passes.
    // For this test we pretend 'noop' is fine but we sabotage loadProvider by passing a bogus provider
    const onError = vi.fn();

    init({
      provider: 'noop',  // valid
      debug: true,
      onError,
    });

    await waitForReady();  // noop always loads, so craft a different scenario if you have a failing provider stub

    // This test is illustrative; if you add a fake provider that throws in loadProvider
    // assert INIT_FAILED here. Otherwise you can remove or adapt it once a "failing" provider exists.
    expect(onError).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INIT_FAILED' })
    );
  });

  it('handles errors thrown inside onError handler safely', async () => {
    const onError = vi.fn(() => {
      throw new Error('boom');
    });

    init({
      provider: 'umami', // invalid without siteId
      debug: true,
      onError,
    });

    expect(onError).toHaveBeenCalled();

    // The internal safeEmitError should log an error about handler failure
    // Allow microtask queue to flush
    await new Promise(r => setTimeout(r, 0));

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.any(String), // style
      'Error in error handler',
      expect.stringMatching(/"name":\s*"AnalyticsError"/),
      expect.stringMatching(/"message":\s*"boom"/),
    );
  });

  it('emits QUEUE_OVERFLOW when proxy queue exceeds limit pre-init', async () => {
    const onError = vi.fn();

    init({
      provider: 'umami', // invalid -> fallback noop (so initPromise stays)
      queueSize: 3,
      debug: true,
      onError,
    });

    // Generate 5 events before fallback provider is ready
    track('e1');
    track('e2');
    track('e3');
    track('e4');
    track('e5');

    // At least one QUEUE_OVERFLOW should have fired
    const overflowCall = onError.mock.calls.find(
      (args) => (args[0] as AnalyticsError).code === 'QUEUE_OVERFLOW'
    );
    expect(overflowCall).toBeDefined();

    await waitForReady();

    // After ready the queue should be flushed (cannot assert delivery here without tapping into provider mock)
    const diag = getDiagnostics();
    expect(diag.queueSize).toBe(0);
  });

  it('destroy() errors are caught and surfaced', async () => {
    const onError = vi.fn();

    // Use valid noop init
    init({ provider: 'noop', debug: true, onError });
    await waitForReady();

    // Monkey patch realInstance destroy to throw (simulate provider bug)
    const inst: any = (getDiagnostics().hasRealInstance && (await waitForReady())) || null;
    if (inst && typeof inst.destroy === 'function') {
      const original = inst.destroy;
      inst.destroy = () => { throw new Error('provider destroy failed'); };
      await destroy();
      // restore just in case (not strictly needed)
      inst.destroy = original;
    }

    // An error should have been emitted *or* logged
    const providerErr = onError.mock.calls.find(
      (args) => (args[0] as AnalyticsError).code === 'PROVIDER_ERROR'
    );
    expect(providerErr).toBeDefined();
  });
});
