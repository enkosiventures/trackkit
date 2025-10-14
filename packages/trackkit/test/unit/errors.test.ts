/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  init,
  track,
  waitForReady,
  getDiagnostics,
} from '../../src';
import {
  AnalyticsError,
  dispatchError,
  setUserErrorHandler,
  normalizeError,
  isAnalyticsError,
} from '../../src/errors';
import { resetTests } from '../helpers/core';
import * as Log from '../../src/util/logger';

// @vitest-environment jsdom

describe('Error pipeline', () => {
  it('invokes user error handler with AnalyticsError', () => {
    let seen: any = null;
    setUserErrorHandler((e) => { seen = e; });
    const err = new AnalyticsError('boom', 'INIT_FAILED', 'noop');
    dispatchError(err);
    expect(seen).toBeInstanceOf(AnalyticsError);
    expect(seen.code).toBe('INIT_FAILED');

    // restore default
    setUserErrorHandler(null);
  });
});


describe('Error handling (Facade)', () => {
  let logger: any;

  beforeEach(() => {
    logger = vi.spyOn(Log, 'logger', 'get').mockReturnValue({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as any);
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
    const errorCalls = logger.mock.results?.[0]?.value?.error?.mock?.calls ?? [];
    const hadHandlerFailureLog = errorCalls.some(call =>
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

  it('normalizeError: passes AnalyticsError through unchanged', () => {
    const err = new AnalyticsError('a', 'UNKNOWN', 'p');
    expect(normalizeError(err)).toBe(err);
  });

  it('normalizeError: wraps native Error and sets provider/fallback code', () => {
    const native = new Error('boom');
    const out = normalizeError(native, 'TIMEOUT', 'umami');
    expect(isAnalyticsError(out)).toBe(true);
    expect(out.code).toBe('TIMEOUT');
    expect(out.provider).toBe('umami');
    expect(out.originalError).toBe(native);
  });

  it('normalizeError: string/unknown gets stringified', () => {
    const out = normalizeError(123 as any, 'INVALID_CONFIG', 'ga4');
    expect(out).toBeInstanceOf(AnalyticsError);
    expect(out.message).toBe('123');
    expect(out.code).toBe('INVALID_CONFIG');
    expect(out.provider).toBe('ga4');
  });

  it('dispatchError: with NO user handler, default handler logs (once) and de-dupes repeats', () => {
    dispatchError(new Error('dup'), 'READY_TIMEOUT');
    dispatchError(new Error('dup'), 'READY_TIMEOUT');
    expect(logger).toHaveBeenCalledTimes(1); // de-duped
  });

  it('dispatchError: with user handler, default handler does not run', () => {
    const user = vi.fn();
    setUserErrorHandler(user);
    dispatchError(new Error('x'), 'UNKNOWN');
    expect(user).toHaveBeenCalledTimes(1);
    // default handler shouldn't run in this mode
    expect(logger).not.toHaveBeenCalledWith(
      expect.stringContaining('Unhandled analytics error'),
      expect.anything()
    );
  });

  it('dispatchError: user handler exceptions are caught and logged, then default still invoked if no user handler set', () => {
    // Install a user handler that throws, then unset it to exercise default path
    setUserErrorHandler(() => { throw new Error('handler blew up'); });
    dispatchError(new Error('payload 1'), 'UNKNOWN');

    // Immediately unset to force the "no user handler" branch for default handler
    setUserErrorHandler(null);
    dispatchError(new Error('payload 2'), 'UNKNOWN');

    // One log (the first) should contain "Error in error handler"
    const errorCalls = logger.mock.results?.[0]?.value?.error?.mock?.calls ?? [];
    expect(errorCalls.filter((args: any[]) => args.join(' ').includes('Error in error handler'))).toHaveLength(1);
  });
});
