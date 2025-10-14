/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init, track, waitForReady, grantConsent } from '../../src';
import { resetTests } from '../helpers/core';

// @vitest-environment jsdom

describe('Debug mode', () => {
  let consoleLog: any;
  
  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    resetTests();
  });
  
  afterEach(() => {
    resetTests();
    consoleLog.mockRestore();
  });
  
  it('logs initialization in debug mode', async () => {
    init({ debug: true });
    await waitForReady();

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.anything(),
      'Initializing analytics',
      expect.objectContaining({
        provider: 'noop',
      })
    );
  });
  
  it('logs method calls in debug mode', async () => {
    init({
      debug: true,
      consent: { requireExplicit: false },
      trackLocalhost: true,
    });
    await waitForReady();
    grantConsent();

    await track('test_event', { value: 42 });

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('[trackkit]'),
      expect.anything(),
      '[no-op] track',
      expect.objectContaining({
        name: 'test_event',
        props: { value: 42 },
      })
    );
  });
  
  it('does not log in production mode', async () => {
    init({ debug: false });

    // Clear previous logs
    consoleLog.mockClear();

    await waitForReady();

    track('test_event');

    expect(consoleLog).not.toHaveBeenCalled();
  });
});