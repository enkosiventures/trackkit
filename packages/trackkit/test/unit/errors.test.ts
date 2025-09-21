/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  init,
  track,
  destroy,
  waitForReady,
  getDiagnostics,
} from '../../src';
import { resetTests } from '../helpers/core';

// @vitest-environment jsdom

describe('Error handling (Facade)', () => {
  let consoleError: any;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    resetTests(vi);
  });

  afterEach(async () => {
    resetTests(vi);
  });

  it('falls back to noop for unknown provider (no INVALID_CONFIG emitted)', async () => {
    const onError = vi.fn();

    init({ provider: 'ghost' as any, debug: true, onError });
    await waitForReady();

    // Current facade normalizes to noop quietly.
    expect(onError).not.toHaveBeenCalled();

    const diag = getDiagnostics();
    expect(diag?.provider.key).toBe('noop');
    expect(diag?.provider.state).toBe('ready');
  });

  it('emits INVALID_CONFIG and falls back to noop for provider with missing required options', async () => {
    const onError = vi.fn();

    init({
      provider: 'umami',      // umami spec requires website; we omit it
      debug: true,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_CONFIG',
        provider: 'umami',
      })
    );

    await waitForReady();
    const diag = getDiagnostics();
    expect(diag?.provider.key).toBe('noop');
    expect(diag?.provider.state).toBe('ready');
  });

  it('handles errors thrown inside onError handler safely', async () => {
    const loudHandler = vi.fn(() => { throw new Error('boom'); });

    // Use provider with invalid config to trigger invalid-config path
    init({ provider: 'umami', debug: true, onError: loudHandler });

    // The handler was invoked (and threw), but we shouldn't crash.
    await new Promise(r => setTimeout(r, 0));

    // Assert: somewhere in error logs we note "Error in error handler" and include the thrown message.
    const hadHandlerFailureLog = consoleError.mock.calls.some(call =>
      call.join(' ').includes('Error in error handler') &&
      call.join(' ').includes('"message":"boom"')
    );
    expect(hadHandlerFailureLog).toBe(true);
  });

  it('emits QUEUE_OVERFLOW when facade queue exceeds limit after reconfigure', async () => {
    const onError = vi.fn();

    // Valid provider so reconfigureQueue runs; keep consent pending to force queueing.
    init({
      provider: 'noop',
      queueSize: 3,
      debug: true,
      trackLocalhost: true,
      consent: { requireExplicit: true },
      onError,
    });

    await waitForReady(); // ensures queue is reconfigured to size=3

    // 4 events → overflow of size 3
    track('e1');
    track('e2');
    track('e3');
    track('e4');

    // onOverflow -> handleQueueOverflow -> onError(QUEUE_OVERFLOW)
    const overflowCall = onError.mock.calls.find(
      (args) => args[0] && (args[0] as any).code === 'QUEUE_OVERFLOW'
    );
    expect(overflowCall).toBeDefined();
  });

  // it('destroy() errors are caught and surfaced as PROVIDER_ERROR', async () => {
  //   const onError = vi.fn();

  //   init({ provider: 'noop', debug: true, onError });
  //   await waitForReady();

  //   // Get the stateful wrapper and sabotage the inner provider.destroy()
  //   const facade = getFacade();
  //   expect(facade).toBeDefined();

  //   const innerProvider = facade?.getProvider();
  //   expect(innerProvider).toBeDefined();
  //   const originalDestroy = innerProvider!.destroy;
  //   innerProvider!.destroy = () => { throw new Error('provider destroy failed'); };

  //   // destroy should catch and emit
  //   destroy();

  //   // restore to avoid bleed
  //   innerProvider!.destroy = originalDestroy;

  //   console.warn('onError calls:', onError.mock.calls);

  //   const providerErr = onError.mock.calls.find(
  //     (args) => (args[0] as AnalyticsError).code === 'PROVIDER_ERROR'
  //   );
  //   expect(providerErr).toBeDefined();
  // });
});
